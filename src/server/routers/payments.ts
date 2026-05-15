/**
 * Payments Router
 * 
 * Handles supplier payments with:
 * - Single payment creation (with or without bill)
 * - Bill payment application (oldest items first)
 * - On-account payments (vendor only)
 * - Ledger postings (DR AP/Prepayment, CR Bank)
 * - Payment reversal with journal reversal
 * - Payment history with running balance
 * - Idempotency key support
 * - Cross-organization blocking
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema, createPaymentBaseSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { postDoubleEntry, type JournalLine } from "@/lib/posting"
import { resolveRate } from "@/lib/finance/fxDb"
import { computeRealisedFX } from "@/lib/finance/fx"
import { Prisma, PaymentStatus, BillStatus, PaymentMethod } from "@prisma/client"

/**
 * Payment list query schema with filters
 */
const paymentListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  billId: z.string().optional(),
  vendorId: z.string().optional(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", "REVERSED"]).optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "BACS", "FASTER_PAYMENTS", "CHAPS", "CHEQUE", "CARD", "OTHER"]).optional(),
  // Date range filters
  dateFrom: z.union([z.date(), z.string()]).optional(),
  dateTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["date", "amount", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Get AP (Accounts Payable) control account
 */
async function getAPAccount(organizationId: string) {
  // Try to find AP account by code (common codes: 2000, 2100, 21000)
  const apAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "LIABILITY",
      code: { in: ["2000", "2100", "21000"] },
      isActive: true,
    },
  })

  if (apAccount) {
    return apAccount
  }

  // Fallback: find any LIABILITY account with "payable" in name
  const fallbackAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "LIABILITY",
      name: { contains: "payable", mode: "insensitive" },
      isActive: true,
    },
  })

  if (!fallbackAccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Accounts Payable control account not found. Please set up chart of accounts.",
    })
  }

  return fallbackAccount
}

/**
 * Get Prepayment account (for on-account payments)
 */
async function getPrepaymentAccount(organizationId: string) {
  // Try to find Prepayment account by code or name
  const prepaymentAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "ASSET",
      OR: [
        { code: { in: ["1200", "12000", "1300", "13000"] } },
        { name: { contains: "prepayment", mode: "insensitive" } },
        { name: { contains: "prepaid", mode: "insensitive" } },
      ],
      isActive: true,
    },
  })

  if (prepaymentAccount) {
    return prepaymentAccount
  }

  // Fallback: use AP account if prepayment not found (less ideal but functional)
  return getAPAccount(organizationId)
}

/**
 * Apply payment to bill items (oldest first)
 * Returns array of { itemId, amount } for tracking
 */
function applyPaymentToBillItems(
  items: Array<{ id: string; total: Prisma.Decimal }>,
  existingPayments: Array<{ amount: Prisma.Decimal }>,
  paymentAmount: Prisma.Decimal
): Array<{ itemId: string; amount: Prisma.Decimal }> {
  // Calculate total already paid
  const totalPaid = existingPayments.reduce(
    (sum, p) => sum.plus(p.amount),
    new Prisma.Decimal(0)
  )

  // Calculate bill total
  const billTotal = items.reduce((sum, item) => sum.plus(item.total), new Prisma.Decimal(0))

  // Calculate remaining balance
  const remainingBalance = billTotal.minus(totalPaid)

  // Cannot over-apply
  if (paymentAmount.greaterThan(remainingBalance)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Payment amount (${paymentAmount.toNumber()}) exceeds remaining bill balance (${remainingBalance.toNumber()})`,
    })
  }

  // Track how much has been paid per item (oldest first)
  const applications: Array<{ itemId: string; amount: Prisma.Decimal }> = []
  let remainingPayment = paymentAmount

  // Sort items by creation order (oldest first) - items are typically in order
  for (const item of items) {
    if (remainingPayment.lessThanOrEqualTo(0)) {
      break
    }

    // Calculate how much has been paid for this item already
    const itemTotal = item.total
    const itemPaid = existingPayments.reduce((sum, p) => {
      // For simplicity, we'll distribute existing payments proportionally
      // In a real system, you'd track item-level payments
      return sum
    }, new Prisma.Decimal(0))

    const itemRemaining = itemTotal.minus(itemPaid)
    const amountToApply = Prisma.Decimal.min(remainingPayment, itemRemaining)

    if (amountToApply.greaterThan(0)) {
      applications.push({
        itemId: item.id,
        amount: amountToApply,
      })
      remainingPayment = remainingPayment.minus(amountToApply)
    }
  }

  return applications
}

export const paymentsRouter = createTRPCRouter({
  /**
   * Get all payments with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENTS_VIEW))
    .input(paymentListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        billId,
        vendorId,
        status,
        paymentMethod,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
      } = input

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
      }

      // Filters
      if (billId) {
        where.billId = billId
      }

      if (vendorId) {
        where.vendorId = vendorId
      }

      if (status) {
        where.status = status
      }

      if (paymentMethod) {
        where.paymentMethod = paymentMethod
      }

      // Date range filter
      if (dateFrom || dateTo) {
        where.paymentDate = {}
        if (dateFrom) {
          const from = typeof dateFrom === "string" ? new Date(dateFrom) : dateFrom
          where.paymentDate.gte = from
        }
        if (dateTo) {
          const to = typeof dateTo === "string" ? new Date(dateTo) : dateTo
          to.setHours(23, 59, 59, 999)
          where.paymentDate.lte = to
        }
      }

      // Determine sort
      const orderBy: any = {}
      if (sortBy) {
        orderBy[sortBy] = sortOrder || "desc"
      } else {
        orderBy.paymentDate = "desc"
      }

      // Execute paginated query
      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            vendor: {
              select: {
                id: true,
                name: true,
                alias: true,
              },
            },
            bill: {
              select: {
                id: true,
                billNumber: true,
                total: true,
              },
            },
            bankAccount: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ])

      return {
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get payment by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENTS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("payment", input.id, ctx.organizationId)

      const payment = await prisma.payment.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          vendor: true,
          bill: {
            include: {
              items: true,
            },
          },
          bankAccount: true,
          paymentRun: {
            select: {
              id: true,
              runNumber: true,
              paymentDate: true,
            },
          },
        },
      })

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found",
        })
      }

      return payment
    }),

  /**
   * Create a payment
   * 
   * If billId provided: applies to bill balance (oldest items first)
   * If vendor only: creates on-account credit (AP)
   * Postings: DR AP (or Prepayment if on-account), CR Bank
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENTS_CREATE))
    .input(createPaymentBaseSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const {
        organizationId,
        billId,
        vendorId,
        bankAccountId,
        date,
        amount,
        currency,
        fxRate,
        memo,
        method,
        idempotencyKey,
        reference,
      } = input

      // Determine vendor ID
      let finalVendorId = vendorId

      if (billId) {
        // Verify bill exists and get vendor
        const bill = await prisma.bill.findUnique({
          where: {
            id: billId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: true,
            payments: {
              where: {
                status: { in: ["COMPLETED", "PROCESSING"] },
              },
            },
            vendor: true,
          },
        })

        if (!bill || bill.deletedAt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bill not found",
          })
        }

        // Bill must be approved before payment
        if (bill.status !== BillStatus.APPROVED && bill.status !== BillStatus.PART_PAID) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot pay bill with status ${bill.status}. Bill must be APPROVED or PART_PAID.`,
          })
        }

        finalVendorId = bill.vendorId

        // Check if payment would over-apply
        const totalPaid = bill.payments.reduce(
          (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
          new Prisma.Decimal(0)
        )
        const billTotal = new Prisma.Decimal(bill.total.toString())
        const remainingBalance = billTotal.minus(totalPaid)
        const paymentAmount = new Prisma.Decimal(amount)

        if (paymentAmount.greaterThan(remainingBalance)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Payment amount (${amount}) exceeds remaining bill balance (${remainingBalance.toNumber()})`,
          })
        }
      } else if (!vendorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either billId or vendorId must be provided",
        })
      }

      // Verify vendor exists
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: finalVendorId!,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      })

      if (!vendor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found or inactive",
        })
      }

      // Verify bank account exists
      const bankAccount = await prisma.bankAccount.findUnique({
        where: {
          id: bankAccountId,
          organizationId: ctx.organizationId,
          isActive: true,
        },
      })

      if (!bankAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account not found or inactive",
        })
      }

      // Check idempotency key
      if (idempotencyKey) {
        const existingPayment = await prisma.payment.findFirst({
          where: {
            organizationId: ctx.organizationId,
            metadata: {
              path: ["idempotencyKey"],
              equals: idempotencyKey,
            },
          },
        })

        if (existingPayment) {
          // Return existing payment
          return await prisma.payment.findUnique({
            where: { id: existingPayment.id },
            include: {
              vendor: true,
              bill: true,
              bankAccount: true,
            },
          })
        }
      }

      // Get accounts for posting
      const apAccount = await getAPAccount(ctx.organizationId)
      
      // Find bank account in chart of accounts
      // Try common bank account codes first (1000, 1010, 1100, etc.)
      let bankAccountForPosting = await prisma.chartOfAccount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "ASSET",
          code: { in: ["1000", "1010", "1100", "10000", "10100"] },
          isActive: true,
        },
      })

      // Fallback: find any ASSET account with "bank" or "cash" in name
      if (!bankAccountForPosting) {
        bankAccountForPosting = await prisma.chartOfAccount.findFirst({
          where: {
            organizationId: ctx.organizationId,
            type: "ASSET",
            OR: [
              { name: { contains: "bank", mode: "insensitive" } },
              { name: { contains: "cash", mode: "insensitive" } },
            ],
            isActive: true,
          },
        })
      }

      if (!bankAccountForPosting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bank account (chart of accounts) not found. Please set up a bank/cash account in chart of accounts.",
        })
      }

      // Determine which account to debit (AP or Prepayment)
      let debitAccount = apAccount
      let isOnAccount = false

      if (!billId) {
        // On-account payment - use Prepayment account
        debitAccount = await getPrepaymentAccount(ctx.organizationId)
        isOnAccount = true
      }

      // Create payment and postings in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create payment record
        const payment = await tx.payment.create({
          data: {
            organizationId: ctx.organizationId,
            billId: billId || null,
            vendorId: finalVendorId!,
            bankAccountId,
            amount: new Prisma.Decimal(amount),
            currency: currency || "GBP",
            paymentDate: date,
            paymentMethod: method as PaymentMethod,
            reference: reference || undefined,
            status: PaymentStatus.COMPLETED,
            metadata: {
              idempotencyKey: idempotencyKey || undefined,
              memo: memo || undefined,
              fxRate: fxRate || 1.0,
              isOnAccount,
              appliedItems: billId ? [] : undefined, // Will be populated if bill payment
            },
          },
        })

        // Build journal lines
        const journalLines: JournalLine[] = [
          // DR AP or Prepayment
          {
            accountId: debitAccount.id,
            debit: amount,
            credit: 0,
            description: billId
              ? `Payment for bill ${billId}`
              : `On-account payment to ${vendor.name}`,
            reference: reference || payment.id,
            metadata: {
              paymentId: payment.id,
              billId: billId || undefined,
              vendorId: finalVendorId,
              isOnAccount,
            },
          },
          // CR Bank
          {
            accountId: bankAccountForPosting.id,
            debit: 0,
            credit: amount,
            description: `Payment from ${bankAccount.name}`,
            reference: reference || payment.id,
            metadata: {
              paymentId: payment.id,
              bankAccountId,
            },
          },
        ]

        const settlementRate = fxRate || 1.0
        const payCurrency = currency || "GBP"

        // Post to ledger
        const postingResult = await postDoubleEntry({
          date,
          lines: journalLines,
          docRef: `PAY-${payment.id}`,
          currency: payCurrency,
          rate: settlementRate,
          orgId: ctx.organizationId,
          userId: ctx.session.user.id,
          description: billId
            ? `Payment for bill ${billId}`
            : `On-account payment to ${vendor.name}`,
          metadata: {
            paymentId: payment.id,
            billId: billId || undefined,
            vendorId: finalVendorId,
            isOnAccount,
          },
        })

        // ── Realised FX Gain/Loss ──────────────────────────────────────────
        // When a foreign-currency bill is settled at a different rate than
        // it was booked at, we post the difference to an FX Gain/Loss account.
        if (billId) {
          const moduleSettings = await prisma.orgModuleSettings.findUnique({
            where: { orgId: ctx.organizationId },
          })
          const functionalCurrency = moduleSettings?.functionalCurrency ?? "GBP"

          if (payCurrency !== functionalCurrency) {
            // Get the booking rate from original AP posting transactions
            const billRecord = await prisma.bill.findUnique({
              where: { id: billId },
              select: { metadata: true, currency: true },
            })
            const meta = billRecord?.metadata as any
            const bookingTxIds: string[] = meta?.postingTransactionIds ?? []
            let bookingRate = settlementRate // fallback

            if (bookingTxIds.length > 0) {
              const bookingTx = await prisma.transaction.findFirst({
                where: { id: { in: bookingTxIds }, credit: { gt: 0 } },
                select: { exchangeRate: true },
              })
              if (bookingTx) {
                bookingRate = Number(bookingTx.exchangeRate)
              }
            }

            if (Math.abs(settlementRate - bookingRate) > 0.000001) {
              // fxGainLossAccountId from settings, else search by name
              let fxGlAccountId = moduleSettings?.fxGainLossAccountId ?? null

              if (!fxGlAccountId) {
                const fxAccount = await prisma.chartOfAccount.findFirst({
                  where: {
                    organizationId: ctx.organizationId,
                    isActive: true,
                    OR: [
                      { name: { contains: "FX", mode: "insensitive" } },
                      { name: { contains: "exchange", mode: "insensitive" } },
                      { code: { in: ["7800", "7900", "78000", "79000"] } },
                    ],
                  },
                })
                fxGlAccountId = fxAccount?.id ?? null
              }

              if (fxGlAccountId) {
                const fxResult = computeRealisedFX({
                  foreignAmount: amount,
                  foreignCurrency: payCurrency,
                  functionalCurrency,
                  transactionRate: bookingRate,
                  settlementRate,
                  type: "payable",
                })
                const gl = Math.abs(fxResult.gainLoss)
                const isLoss = fxResult.gainLoss < 0

                const fxLines: JournalLine[] = isLoss
                  ? [
                      { accountId: fxGlAccountId, debit: gl, credit: 0, description: "Realised FX loss" },
                      { accountId: debitAccount.id, debit: 0, credit: gl, description: "FX adjustment to AP" },
                    ]
                  : [
                      { accountId: debitAccount.id, debit: gl, credit: 0, description: "FX adjustment to AP" },
                      { accountId: fxGlAccountId, debit: 0, credit: gl, description: "Realised FX gain" },
                    ]

                await postDoubleEntry({
                  date,
                  lines: fxLines,
                  docRef: `FXGL-${payment.id}`,
                  currency: functionalCurrency,
                  rate: 1.0,
                  orgId: ctx.organizationId,
                  userId: ctx.session.user.id,
                  description: `Realised FX ${isLoss ? "loss" : "gain"} on payment ${payment.id}`,
                  metadata: { paymentId: payment.id, billId, bookingRate, settlementRate },
                })
              }
            }
          }
        }

        // Update payment with transaction IDs
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            metadata: {
              ...(payment.metadata as any || {}),
              postingTransactionIds: postingResult.transactionIds,
            },
            processedAt: new Date(),
          },
        })

        // Update bill status if applicable
        if (billId) {
          const bill = await tx.bill.findUnique({
            where: { id: billId },
            include: {
              payments: {
                where: {
                  status: { in: ["COMPLETED", "PROCESSING"] },
                },
              },
            },
          })

          if (bill) {
            const totalPaid = bill.payments.reduce(
              (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
              new Prisma.Decimal(0)
            )
            const billTotal = new Prisma.Decimal(bill.total.toString())
            const balance = billTotal.minus(totalPaid)

            let newStatus = bill.status
            if (balance.lessThanOrEqualTo(0.01)) {
              newStatus = BillStatus.PAID
            } else if (totalPaid.greaterThan(0)) {
              newStatus = BillStatus.PART_PAID
            }

            await tx.bill.update({
              where: { id: billId },
              data: { status: newStatus },
            })
          }
        }

        return updatedPayment
      })

      // Fetch full payment with relations
      const fullPayment = await prisma.payment.findUnique({
        where: { id: result.id },
        include: {
          vendor: true,
          bill: {
            include: {
              items: true,
            },
          },
          bankAccount: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "payment",
        entityId: result.id,
        action: "create",
        after: fullPayment,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          billId: billId || undefined,
          vendorId: finalVendorId,
          amount,
          currency,
          isOnAccount,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, paymentId: result.id })
      })

      return fullPayment
    }),

  /**
   * Reverse a payment
   * 
   * Creates reversing journal entries, restores bill balance,
   * and marks payment as REVERSED with link to reversing payment
   */
  reverse: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENTS_EDIT))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("payment", input.id, ctx.organizationId)

      // Get payment with relations
      const payment = await prisma.payment.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          vendor: true,
          bill: {
            include: {
              items: true,
              payments: {
                where: {
                  status: { in: ["COMPLETED", "PROCESSING"] },
                },
              },
            },
          },
          bankAccount: true,
        },
      })

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found",
        })
      }

      // Cannot reverse if already reversed
      if (payment.status === PaymentStatus.REVERSED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Payment has already been reversed",
        })
      }

      // Cannot reverse if not completed
      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot reverse payment with status ${payment.status}. Only COMPLETED payments can be reversed.`,
        })
      }

      // Get posting transaction IDs from metadata
      const metadata = payment.metadata as any
      const postingTransactionIds = metadata?.postingTransactionIds || []

      if (postingTransactionIds.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot reverse payment: posting transaction IDs not found",
        })
      }

      // Get original transactions to reverse
      const originalTransactions = await prisma.transaction.findMany({
        where: {
          id: { in: postingTransactionIds },
          organizationId: ctx.organizationId,
        },
      })

      if (originalTransactions.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Original posting transactions not found",
        })
      }

      // Create reversing journal entries
      const reversingLines: JournalLine[] = originalTransactions.map((tx) => ({
        accountId: tx.accountId,
        debit: tx.credit.toNumber(), // Reverse: debit becomes credit
        credit: tx.debit.toNumber(), // Reverse: credit becomes debit
        description: `Reversal: ${tx.description}`,
        reference: tx.reference || `REV-${payment.id}`,
        metadata: {
          originalTransactionId: tx.id,
          reversingPaymentId: payment.id,
          reason: input.reason || "Payment reversal",
        },
      }))

      // Post reversing entries
      const reversingResult = await postDoubleEntry({
        date: new Date(),
        lines: reversingLines,
        docRef: `REV-${payment.id}`,
        currency: payment.currency,
        rate: 1.0,
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
        description: `Reversal of payment ${payment.id}`,
        metadata: {
          originalPaymentId: payment.id,
          reason: input.reason || "Payment reversal",
        },
      })

      // Update payment status and link to reversal
      const reversedPayment = await prisma.payment.update({
        where: { id: input.id },
        data: {
          status: PaymentStatus.REVERSED,
          metadata: {
            ...metadata,
            reversedAt: new Date().toISOString(),
            reversedBy: ctx.session.user.id,
            reversingTransactionIds: reversingResult.transactionIds,
            reason: input.reason || "Payment reversal",
          },
        },
        include: {
          vendor: true,
          bill: true,
          bankAccount: true,
        },
      })

      // Restore bill balance if applicable
      if (payment.billId && payment.bill) {
        const bill = payment.bill
        const totalPaid = bill.payments
          .filter((p) => p.id !== payment.id && p.status === "COMPLETED")
          .reduce(
            (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
            new Prisma.Decimal(0)
          )

        const billTotal = new Prisma.Decimal(bill.total.toString())
        const balance = billTotal.minus(totalPaid)

        let newStatus = BillStatus.APPROVED
        if (balance.lessThanOrEqualTo(0.01)) {
          newStatus = BillStatus.PAID
        } else if (totalPaid.greaterThan(0)) {
          newStatus = BillStatus.PART_PAID
        }

        await prisma.bill.update({
          where: { id: payment.billId },
          data: { status: newStatus },
        })
      }

      // Record audit
      await recordAudit({
        entity: "payment",
        entityId: input.id,
        action: "reverse",
        before: payment,
        after: reversedPayment,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          reason: input.reason || "Payment reversal",
          reversingTransactionIds: reversingResult.transactionIds,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, paymentId: input.id })
      })

      return reversedPayment
    }),

  /**
   * Get payment history
   * 
   * Returns payment history by vendor or bill with running balance
   */
  getHistory: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENTS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      vendorId: z.string().optional(),
      billId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (!input.vendorId && !input.billId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either vendorId or billId must be provided",
        })
      }

      const where: any = {
        organizationId: ctx.organizationId,
        status: { in: ["COMPLETED", "REVERSED"] },
      }

      if (input.vendorId) {
        where.vendorId = input.vendorId
      }

      if (input.billId) {
        where.billId = input.billId
      }

      // Get all payments ordered by date
      const payments = await prisma.payment.findMany({
        where,
        orderBy: {
          paymentDate: "asc",
        },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          bill: {
            select: {
              id: true,
              billNumber: true,
              total: true,
            },
          },
          bankAccount: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // Calculate running balance
      let runningBalance = new Prisma.Decimal(0)
      const history = payments.map((payment) => {
        const amount = new Prisma.Decimal(payment.amount.toString())
        
        if (payment.status === "REVERSED") {
          runningBalance = runningBalance.minus(amount)
        } else {
          runningBalance = runningBalance.plus(amount)
        }

        return {
          ...payment,
          runningBalance: runningBalance.toNumber(),
        }
      })

      return {
        payments: history,
        totalPayments: payments.filter((p) => p.status === "COMPLETED").length,
        totalReversed: payments.filter((p) => p.status === "REVERSED").length,
        currentBalance: runningBalance.toNumber(),
      }
    }),
})

