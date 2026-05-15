/**
 * Payment Runs Router
 * 
 * Handles batch supplier payments with:
 * - Payment run creation with selection criteria or explicit bill IDs
 * - Bill snapshot and bank account snapshot
 * - Payment run processing (creates individual payments)
 * - BACS/CSV file export
 * - Status tracking (DRAFT -> PROCESSING -> COMPLETED)
 * - Idempotent processing
 * - Transaction wrapping for atomicity
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema, createPaymentRunBaseSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { postDoubleEntry, type JournalLine } from "@/lib/posting"
import { Prisma, PaymentRunStatus, BillStatus, PaymentMethod, PaymentStatus } from "@prisma/client"

/**
 * Payment run list query schema with filters
 */
const paymentRunListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "BACS", "FASTER_PAYMENTS", "CHAPS", "CHEQUE", "CARD", "OTHER"]).optional(),
  // Date range filters
  dateFrom: z.union([z.date(), z.string()]).optional(),
  dateTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["paymentDate", "createdAt", "totalAmount"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Generate unique payment run number
 */
async function generatePaymentRunNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PR-${year}-`

  // Find the highest run number for this year
  const lastRun = await prisma.paymentRun.findFirst({
    where: {
      organizationId,
      runNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      runNumber: "desc",
    },
  })

  if (!lastRun) {
    return `${prefix}001`
  }

  // Extract number and increment
  const lastNumber = parseInt(lastRun.runNumber.replace(prefix, ""), 10)
  const nextNumber = (lastNumber + 1).toString().padStart(3, "0")

  return `${prefix}${nextNumber}`
}

/**
 * Get outstanding bills based on selection criteria
 */
async function getOutstandingBillsByCriteria(
  organizationId: string,
  criteria: {
    vendorIds?: string[]
    dueDateTo?: Date
    minAmount?: number
    billIds?: string[]
  }
) {
  const where: any = {
    organizationId,
    deletedAt: null,
    status: {
      in: [BillStatus.APPROVED, BillStatus.PART_PAID, BillStatus.OVERDUE],
    },
  }

  // If explicit bill IDs provided, use those
  if (criteria.billIds && criteria.billIds.length > 0) {
    where.id = { in: criteria.billIds }
  } else {
    // Apply selection criteria
    if (criteria.vendorIds && criteria.vendorIds.length > 0) {
      where.vendorId = { in: criteria.vendorIds }
    }

    if (criteria.dueDateTo) {
      where.dueDate = { lte: criteria.dueDateTo }
    }
  }

  const bills = await prisma.bill.findMany({
    where,
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          alias: true,
          bankAccountNumber: true,
          bankSortCode: true,
          bankIBAN: true,
          bankSWIFT: true,
          bankName: true,
        },
      },
      payments: {
        where: {
          status: { in: ["COMPLETED", "PROCESSING"] },
        },
        select: {
          id: true,
          amount: true,
          paymentDate: true,
        },
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  })

  // Calculate balance for each bill and filter
  const outstandingBills = bills
    .map((bill) => {
      const totalPaid = bill.payments.reduce(
        (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
        new Prisma.Decimal(0)
      )

      const balance = new Prisma.Decimal(bill.total.toString()).minus(totalPaid)

      // Apply minAmount filter if specified
      if (criteria.minAmount !== undefined && balance.lessThan(criteria.minAmount)) {
        return null
      }

      return {
        id: bill.id,
        billNumber: bill.billNumber,
        date: bill.date,
        dueDate: bill.dueDate,
        vendor: bill.vendor,
        currency: bill.currency,
        total: bill.total.toNumber(),
        balance: balance.toNumber(),
        totalPaid: totalPaid.toNumber(),
        remittanceInfo: {
          vendorName: bill.vendor.name,
          bankAccountNumber: bill.vendor.bankAccountNumber,
          bankSortCode: bill.vendor.bankSortCode,
          bankIBAN: bill.vendor.bankIBAN,
          bankSWIFT: bill.vendor.bankSWIFT,
          bankName: bill.vendor.bankName,
        },
      }
    })
    .filter((b) => b !== null && b.balance > 0)

  return outstandingBills
}

export const paymentRunsRouter = createTRPCRouter({
  /**
   * Get all payment runs with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENT_RUNS_VIEW))
    .input(paymentRunListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
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
        orderBy.createdAt = "desc"
      }

      // Execute paginated query
      const [paymentRuns, total] = await Promise.all([
        prisma.paymentRun.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            initiator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            bankAccount: {
              select: {
                id: true,
                name: true,
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
              },
            },
            _count: {
              select: {
                payments: true,
              },
            },
          },
        }),
        prisma.paymentRun.count({ where }),
      ])

      return {
        paymentRuns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get payment run by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENT_RUNS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("paymentRun", input.id, ctx.organizationId)

      const paymentRun = await prisma.paymentRun.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          initiator: true,
          bankAccount: true,
          payments: {
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
            },
            orderBy: {
              paymentDate: "asc",
            },
          },
        },
      })

      if (!paymentRun) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment run not found",
        })
      }

      return paymentRun
    }),

  /**
   * Get outstanding bills for payment run
   * 
   * Returns bills available for payment based on selection criteria
   */
  getOutstandingBills: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENT_RUNS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      vendorIds: z.array(z.string()).optional(),
      dueDateTo: z.union([z.date(), z.string()]).optional(),
      minAmount: z.number().optional(),
      currency: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const criteria: any = {
        vendorIds: input.vendorIds,
        minAmount: input.minAmount,
      }

      if (input.dueDateTo) {
        criteria.dueDateTo = typeof input.dueDateTo === "string" 
          ? new Date(input.dueDateTo) 
          : input.dueDateTo
      }

      const bills = await getOutstandingBillsByCriteria(ctx.organizationId, criteria)

      // Apply currency filter if specified
      if (input.currency) {
        return bills.filter((b) => b.currency === input.currency)
      }

      return bills
    }),

  /**
   * Create a payment run
   * 
   * Accepts selection criteria (vendorIds?, dueDateTo?, minAmount?) or explicit billIds
   * Snapshots bills & bank account, status = PENDING (DRAFT)
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENT_RUNS_CREATE))
    .input(createPaymentRunBaseSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const {
        organizationId,
        bankAccountId,
        paymentDate,
        paymentMethod,
        currency,
        notes,
        vendorIds,
        dueDateTo,
        minAmount,
        billIds,
      } = input

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

      // Get outstanding bills based on criteria
      const criteria: any = {
        vendorIds,
        minAmount,
        billIds,
      }

      if (dueDateTo) {
        criteria.dueDateTo = typeof dueDateTo === "string" ? new Date(dueDateTo) : dueDateTo
      }

      const outstandingBills = await getOutstandingBillsByCriteria(ctx.organizationId, criteria)

      if (outstandingBills.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No outstanding bills found matching the selection criteria",
        })
      }

      // Calculate total amount
      const totalAmount = outstandingBills.reduce(
        (sum, bill) => sum.plus(new Prisma.Decimal(bill.balance)),
        new Prisma.Decimal(0)
      )

      // Generate run number
      const runNumber = await generatePaymentRunNumber(ctx.organizationId)

      // Create payment run with snapshot
      const paymentRun = await prisma.paymentRun.create({
        data: {
          organizationId: ctx.organizationId,
          runNumber,
          paymentDate: typeof paymentDate === "string" ? new Date(paymentDate) : paymentDate,
          paymentMethod: paymentMethod as PaymentMethod,
          status: PaymentRunStatus.PENDING, // DRAFT status
          totalAmount,
          currency: currency || "GBP",
          initiatedBy: ctx.session.user.id,
          bankAccountId,
          notes: notes || undefined,
          metadata: {
            // Snapshot of selection criteria
            selectionCriteria: {
              vendorIds: vendorIds || undefined,
              dueDateTo: dueDateTo ? (typeof dueDateTo === "string" ? dueDateTo : dueDateTo.toISOString()) : undefined,
              minAmount: minAmount || undefined,
              billIds: billIds || undefined,
            },
            // Snapshot of bills included
            billSnapshots: outstandingBills.map((bill) => ({
              billId: bill.id,
              billNumber: bill.billNumber,
              balance: bill.balance,
              vendorId: bill.vendor.id,
            })),
            // Snapshot of bank account
            bankAccountSnapshot: {
              id: bankAccount.id,
              name: bankAccount.name,
              accountNumber: bankAccount.accountNumber,
              sortCode: bankAccount.sortCode,
              iban: bankAccount.iban,
              currency: bankAccount.currency,
            },
            createdAt: new Date().toISOString(),
          },
        },
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          bankAccount: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "paymentRun",
        entityId: paymentRun.id,
        action: "create",
        after: paymentRun,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          runNumber: paymentRun.runNumber,
          billCount: outstandingBills.length,
          totalAmount: totalAmount.toNumber(),
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, paymentRunId: paymentRun.id })
      })

      return {
        ...paymentRun,
        billCount: outstandingBills.length,
        bills: outstandingBills,
      }
    }),

  /**
   * Process a payment run
   * 
   * Validates balances, creates payments per bill, updates bills,
   * status → PROCESSING/COMPLETED, wraps in transaction, single audit entry
   */
  process: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENT_RUNS_PROCESS))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      idempotencyKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("paymentRun", input.id, ctx.organizationId)

      // Check idempotency
      if (input.idempotencyKey) {
        const existing = await prisma.paymentRun.findFirst({
          where: {
            id: input.id,
            metadata: {
              path: ["processIdempotencyKey"],
              equals: input.idempotencyKey,
            },
          },
        })

        if (existing && existing.status === PaymentRunStatus.COMPLETED) {
          // Already processed with this key
          return await prisma.paymentRun.findUnique({
            where: { id: input.id },
            include: {
              payments: true,
              initiator: true,
              bankAccount: true,
            },
          })
        }
      }

      // Get payment run with metadata
      const paymentRun = await prisma.paymentRun.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      })

      if (!paymentRun) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment run not found",
        })
      }

      // Cannot process if already completed
      if (paymentRun.status === PaymentRunStatus.COMPLETED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Payment run has already been processed",
        })
      }

      // Cannot process if cancelled
      if (paymentRun.status === PaymentRunStatus.CANCELLED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot process a cancelled payment run",
        })
      }

      // Get bill snapshots from metadata
      const metadata = paymentRun.metadata as any
      const billSnapshots = metadata?.billSnapshots || []

      if (billSnapshots.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No bills found in payment run snapshot",
        })
      }

      // Helper function to get AP account (works with transaction client)
      async function getAPAccount(tx: any, orgId: string) {
        const apAccount = await tx.chartOfAccount.findFirst({
          where: {
            organizationId: orgId,
            type: "LIABILITY",
            code: { in: ["2000", "2100", "21000"] },
            isActive: true,
          },
        })

        if (apAccount) {
          return apAccount
        }

        const fallbackAccount = await tx.chartOfAccount.findFirst({
          where: {
            organizationId: orgId,
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
      
      // Process in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update status to PROCESSING
        const updatedRun = await tx.paymentRun.update({
          where: { id: input.id },
          data: {
            status: PaymentRunStatus.PROCESSING,
            metadata: {
              ...metadata,
              processIdempotencyKey: input.idempotencyKey || undefined,
              processingStartedAt: new Date().toISOString(),
            },
          },
        })

        // Get accounts for posting
        const apAccount = await getAPAccount(tx, ctx.organizationId)
        
        // Find bank account in chart of accounts
        let bankAccountForPosting = await tx.chartOfAccount.findFirst({
          where: {
            organizationId: ctx.organizationId,
            type: "ASSET",
            code: { in: ["1000", "1010", "1100", "10000", "10100"] },
            isActive: true,
          },
        })

        if (!bankAccountForPosting) {
          bankAccountForPosting = await tx.chartOfAccount.findFirst({
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

        // Process each bill
        const createdPayments: Array<{ id: string; billId: string; amount: number }> = []
        let totalProcessed = new Prisma.Decimal(0)

        for (const snapshot of billSnapshots) {
          // Get current bill state
          const bill = await tx.bill.findUnique({
            where: { id: snapshot.billId },
            include: {
              payments: {
                where: {
                  status: { in: ["COMPLETED", "PROCESSING"] },
                },
              },
            },
          })

          if (!bill || bill.deletedAt) {
            console.warn(`Bill ${snapshot.billId} not found or deleted, skipping`)
            continue
          }

          // Calculate current balance
          const totalPaid = bill.payments.reduce(
            (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
            new Prisma.Decimal(0)
          )
          const billTotal = new Prisma.Decimal(bill.total.toString())
          const currentBalance = billTotal.minus(totalPaid)

          // Use snapshot balance or current balance (whichever is smaller to prevent over-payment)
          const paymentAmount = Decimal.min(new Prisma.Decimal(snapshot.balance), currentBalance)

          if (paymentAmount.lessThanOrEqualTo(0)) {
            console.warn(`Bill ${snapshot.billId} has no remaining balance, skipping`)
            continue
          }

          // Create payment
          const payment = await tx.payment.create({
            data: {
              organizationId: ctx.organizationId,
              paymentRunId: input.id,
              billId: snapshot.billId,
              vendorId: snapshot.vendorId,
              bankAccountId: paymentRun.bankAccountId || undefined,
              amount: paymentAmount,
              currency: paymentRun.currency,
              paymentDate: paymentRun.paymentDate,
              paymentMethod: paymentRun.paymentMethod,
              status: PaymentStatus.COMPLETED,
              metadata: {
                paymentRunId: input.id,
                billSnapshot: snapshot,
              },
              processedAt: new Date(),
            },
          })

          // Create ledger postings (DR AP, CR Bank)
          const journalLines: JournalLine[] = [
            {
              accountId: apAccount.id,
              debit: paymentAmount.toNumber(),
              credit: 0,
              description: `Payment for bill ${snapshot.billNumber}`,
              reference: snapshot.billNumber,
              metadata: {
                paymentId: payment.id,
                paymentRunId: input.id,
                billId: snapshot.billId,
                vendorId: snapshot.vendorId,
              },
            },
            {
              accountId: bankAccountForPosting.id,
              debit: 0,
              credit: paymentAmount.toNumber(),
              description: `Payment from ${metadata?.bankAccountSnapshot?.name || "bank account"}`,
              reference: paymentRun.runNumber,
              metadata: {
                paymentId: payment.id,
                paymentRunId: input.id,
                bankAccountId: paymentRun.bankAccountId,
              },
            },
          ]

          await postDoubleEntry({
            date: paymentRun.paymentDate,
            lines: journalLines,
            docRef: `PAY-${payment.id}`,
            currency: paymentRun.currency,
            rate: 1.0,
            orgId: ctx.organizationId,
            userId: ctx.session.user.id,
            description: `Payment run ${paymentRun.runNumber} - Bill ${snapshot.billNumber}`,
            metadata: {
              paymentId: payment.id,
              paymentRunId: input.id,
              billId: snapshot.billId,
            },
          })

          // Update bill status
          const newTotalPaid = totalPaid.plus(paymentAmount)
          let newStatus = bill.status
          if (billTotal.minus(newTotalPaid).lessThanOrEqualTo(0.01)) {
            newStatus = BillStatus.PAID
          } else if (newTotalPaid.greaterThan(0)) {
            newStatus = BillStatus.PART_PAID
          }

          await tx.bill.update({
            where: { id: snapshot.billId },
            data: { status: newStatus },
          })

          createdPayments.push({
            id: payment.id,
            billId: snapshot.billId,
            amount: paymentAmount.toNumber(),
          })

          totalProcessed = totalProcessed.plus(paymentAmount)
        }

        // Update payment run status to COMPLETED
        const finalRun = await tx.paymentRun.update({
          where: { id: input.id },
          data: {
            status: PaymentRunStatus.COMPLETED,
            completedAt: new Date(),
            metadata: {
              ...metadata,
              processIdempotencyKey: input.idempotencyKey || undefined,
              processingCompletedAt: new Date().toISOString(),
              processedPayments: createdPayments,
              totalProcessed: totalProcessed.toNumber(),
            },
          },
        })

        return {
          paymentRun: finalRun,
          payments: createdPayments,
          totalProcessed: totalProcessed.toNumber(),
        }
      })

      // Record single audit entry for entire process
      await recordAudit({
        entity: "paymentRun",
        entityId: input.id,
        action: "process",
        before: paymentRun,
        after: result.paymentRun,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          paymentCount: result.payments.length,
          totalProcessed: result.totalProcessed,
          idempotencyKey: input.idempotencyKey || undefined,
        },
        details: `Processed payment run ${paymentRun.runNumber} with ${result.payments.length} payments`,
      }).catch((error) => {
        console.warn("Audit recording failed", { error, paymentRunId: input.id })
      })

      // Return full payment run with payments
      return await prisma.paymentRun.findUnique({
        where: { id: input.id },
        include: {
          payments: {
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
                },
              },
            },
          },
          initiator: true,
          bankAccount: true,
        },
      })
    }),

  /**
   * Export payment file (BACS/CSV)
   * 
   * Generates BACS or CSV format file with placeholder fields
   * Stores metadata/fileRef
   */
  exportFile: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENT_RUNS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      format: z.enum(["BACS", "CSV"]).default("BACS"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("paymentRun", input.id, ctx.organizationId)

      const paymentRun = await prisma.paymentRun.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          payments: {
            where: {
              status: PaymentStatus.COMPLETED,
            },
            include: {
              vendor: true,
              bill: {
                select: {
                  billNumber: true,
                },
              },
            },
            orderBy: {
              paymentDate: "asc",
            },
          },
          bankAccount: true,
        },
      })

      if (!paymentRun) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment run not found",
        })
      }

      if (paymentRun.payments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No completed payments found in payment run",
        })
      }

      // Generate file content based on format
      let fileContent = ""
      const metadata: any = {
        format: input.format,
        paymentCount: paymentRun.payments.length,
        totalAmount: paymentRun.totalAmount.toNumber(),
        generatedAt: new Date().toISOString(),
      }

      if (input.format === "BACS") {
        // BACS format (simplified - real BACS has specific format requirements)
        fileContent = generateBACSFile(paymentRun, metadata)
      } else {
        // CSV format
        fileContent = generateCSVFile(paymentRun, metadata)
      }

      // Generate file reference
      const fileReference = `${paymentRun.runNumber}-${input.format}-${Date.now()}.${input.format.toLowerCase()}`

      // Update payment run with file reference
      const updatedRun = await prisma.paymentRun.update({
        where: { id: input.id },
        data: {
          fileReference,
          metadata: {
            ...(paymentRun.metadata as any || {}),
            exportFile: {
              format: input.format,
              fileReference,
              generatedAt: new Date().toISOString(),
              paymentCount: paymentRun.payments.length,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "paymentRun",
        entityId: input.id,
        action: "export",
        after: updatedRun,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          format: input.format,
          fileReference,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, paymentRunId: input.id })
      })

      return {
        fileContent,
        fileReference,
        format: input.format,
        paymentCount: paymentRun.payments.length,
        totalAmount: paymentRun.totalAmount.toNumber(),
      }
    }),
})

/**
 * Generate BACS file content
 */
function generateBACSFile(paymentRun: any, metadata: any): string {
  // BACS format (simplified - real implementation would follow BACS specification)
  const lines: string[] = []
  
  // Header record
  lines.push(`H,${paymentRun.runNumber},${paymentRun.paymentDate.toISOString().split('T')[0]},${paymentRun.totalAmount.toNumber()}`)
  
  // Payment records
  for (const payment of paymentRun.payments) {
    const vendor = payment.vendor
    lines.push(
      `P,${vendor.bankAccountNumber || "PLACEHOLDER"},${vendor.bankSortCode || "PLACEHOLDER"},${payment.amount.toNumber()},${vendor.name},${payment.bill?.billNumber || "ON-ACCOUNT"}`
    )
  }
  
  // Footer record
  lines.push(`F,${paymentRun.payments.length},${paymentRun.totalAmount.toNumber()}`)
  
  return lines.join("\n")
}

/**
 * Generate CSV file content
 */
function generateCSVFile(paymentRun: any, metadata: any): string {
  const lines: string[] = []
  
  // CSV header
  lines.push("Payment Date,Supplier Name,Account Number,Sort Code,IBAN,Amount,Currency,Bill Number,Reference")
  
  // Payment records
  for (const payment of paymentRun.payments) {
    const vendor = payment.vendor
    lines.push(
      [
        paymentRun.paymentDate.toISOString().split('T')[0],
        `"${vendor.name}"`,
        vendor.bankAccountNumber || "",
        vendor.bankSortCode || "",
        vendor.bankIBAN || "",
        payment.amount.toNumber(),
        paymentRun.currency,
        payment.bill?.billNumber || "ON-ACCOUNT",
        paymentRun.runNumber,
      ].join(",")
    )
  }
  
  return lines.join("\n")
}

