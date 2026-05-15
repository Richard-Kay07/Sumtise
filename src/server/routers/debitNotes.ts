/**
 * Debit Notes Router
 * 
 * Handles debit notes for supplier bills with:
 * - Create from bill or manual
 * - Apply to bills (partial or full)
 * - Cancel debit notes
 * - Ledger postings (DR AP, CR Expense/COGS/Returns)
 * - Bill balance adjustments
 * - Application ledger tracking
 * - Vendor balance tracking
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema, createDebitNoteBaseSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { postDoubleEntry, type JournalLine } from "@/lib/posting"
import { Prisma, DebitNoteStatus, BillStatus, AccountType } from "@prisma/client"

/**
 * Debit note list query schema with filters
 */
const debitNoteListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  billId: z.string().optional(),
  vendorId: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "APPLIED", "CANCELLED"]).optional(),
  // Date range filters
  dateFrom: z.union([z.date(), z.string()]).optional(),
  dateTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["date", "total", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Calculate debit note totals from items
 */
function calculateDebitNoteTotals(items: Array<{
  quantity: number
  unitPrice: number
  taxRate: number
}>): { subtotal: Prisma.Decimal; taxAmount: Prisma.Decimal; total: Prisma.Decimal } {
  let subtotal = new Prisma.Decimal(0)
  let taxAmount = new Prisma.Decimal(0)

  for (const item of items) {
    const lineSubtotal = new Prisma.Decimal(item.quantity).times(new Prisma.Decimal(item.unitPrice))
    const lineTax = lineSubtotal.times(new Prisma.Decimal(item.taxRate).div(100))
    subtotal = subtotal.plus(lineSubtotal)
    taxAmount = taxAmount.plus(lineTax)
  }

  const total = subtotal.plus(taxAmount)

  return { subtotal, taxAmount, total }
}

/**
 * Generate unique debit note number
 */
async function generateDebitNoteNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `DN-${year}-`

  // Find the highest debit note number for this year
  const lastDebitNote = await prisma.debitNote.findFirst({
    where: {
      organizationId,
      debitNoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      debitNoteNumber: "desc",
    },
  })

  if (!lastDebitNote) {
    return `${prefix}001`
  }

  // Extract number and increment
  const lastNumber = parseInt(lastDebitNote.debitNoteNumber.replace(prefix, ""), 10)
  const nextNumber = (lastNumber + 1).toString().padStart(3, "0")

  return `${prefix}${nextNumber}`
}

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
 * Get Expense Returns/Adjustments account
 */
async function getExpenseReturnsAccount(organizationId: string) {
  // Try to find Expense Returns account by code or name
  const expenseReturnsAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "EXPENSE",
      OR: [
        { code: { in: ["5000", "5100", "50000"] } },
        { name: { contains: "returns", mode: "insensitive" } },
        { name: { contains: "adjustments", mode: "insensitive" } },
        { name: { contains: "credit", mode: "insensitive" } },
      ],
      isActive: true,
    },
  })

  if (expenseReturnsAccount) {
    return expenseReturnsAccount
  }

  // Fallback: find any EXPENSE account
  const fallbackAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "EXPENSE",
      isActive: true,
    },
  })

  if (!fallbackAccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Expense Returns/Adjustments account not found. Please set up chart of accounts.",
    })
  }

  return fallbackAccount
}

export const debitNotesRouter = createTRPCRouter({
  /**
   * Get all debit notes with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(debitNoteListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        billId,
        vendorId,
        status,
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

      // Date range filter
      if (dateFrom || dateTo) {
        where.date = {}
        if (dateFrom) {
          const from = typeof dateFrom === "string" ? new Date(dateFrom) : dateFrom
          where.date.gte = from
        }
        if (dateTo) {
          const to = typeof dateTo === "string" ? new Date(dateTo) : dateTo
          to.setHours(23, 59, 59, 999)
          where.date.lte = to
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
      const [debitNotes, total] = await Promise.all([
        prisma.debitNote.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            bill: {
              select: {
                id: true,
                billNumber: true,
                vendor: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            vendor: {
              select: {
                id: true,
                name: true,
              },
            },
            items: true,
          },
        }),
        prisma.debitNote.count({ where }),
      ])

      // Calculate applied amount and remaining balance for each debit note
      // Since DebitNote doesn't have metadata, we track applications in Bill metadata and notes field
      const debitNotesWithBalance = await Promise.all(
        debitNotes.map(async (dn) => {
          // Try to get from notes field first (faster)
          let totalApplied = 0
          try {
            const notesData = dn.notes ? JSON.parse(dn.notes) : {}
            if (notesData.totalApplied !== undefined) {
              totalApplied = notesData.totalApplied
            } else {
              // Fallback: query bills
              const bills = await prisma.bill.findMany({
                where: {
                  organizationId: ctx.organizationId,
                },
              })
              for (const bill of bills) {
                const billMetadata = (bill.metadata as any) || {}
                const billDebitNotes = billMetadata.debitNotes || []
                const appliedToThisDN = billDebitNotes
                  .filter((app: any) => app.debitNoteId === dn.id)
                  .reduce((sum: number, app: any) => sum + (app.amount || 0), 0)
                totalApplied += appliedToThisDN
              }
            }
          } catch {
            // If notes parsing fails, query bills
            const bills = await prisma.bill.findMany({
              where: {
                organizationId: ctx.organizationId,
              },
            })
            for (const bill of bills) {
              const billMetadata = (bill.metadata as any) || {}
              const billDebitNotes = billMetadata.debitNotes || []
              const appliedToThisDN = billDebitNotes
                .filter((app: any) => app.debitNoteId === dn.id)
                .reduce((sum: number, app: any) => sum + (app.amount || 0), 0)
              totalApplied += appliedToThisDN
            }
          }

          const remaining = new Prisma.Decimal(dn.total.toString()).minus(new Prisma.Decimal(totalApplied))

          return {
            ...dn,
            totalApplied,
            remaining: remaining.toNumber(),
          }
        })
      )

      return {
        debitNotes: debitNotesWithBalance,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get debit note by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("debitNote", input.id, ctx.organizationId)

      const debitNote = await prisma.debitNote.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          bill: {
            include: {
              vendor: true,
              items: true,
            },
          },
          vendor: true,
          items: true,
        },
      })

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        })
      }

      // Calculate applied amount and remaining balance
      // Get from notes field first, then fallback to querying bills
      let totalApplied = 0
      let applications: any[] = []
      
      try {
        const notesData = debitNote.notes ? JSON.parse(debitNote.notes) : {}
        if (notesData.applications) {
          applications = notesData.applications
          totalApplied = notesData.totalApplied || 0
        } else {
          // Fallback: query all bills
          const bills = await prisma.bill.findMany({
            where: {
              organizationId: ctx.organizationId,
            },
          })
          for (const bill of bills) {
            const billMetadata = (bill.metadata as any) || {}
            const billDebitNotes = billMetadata.debitNotes || []
            const appliedToThisDN = billDebitNotes.filter((app: any) => app.debitNoteId === input.id)
            applications.push(...appliedToThisDN)
            totalApplied += appliedToThisDN.reduce((sum: number, app: any) => sum + (app.amount || 0), 0)
          }
        }
      } catch {
        // If notes parsing fails, query bills
        const bills = await prisma.bill.findMany({
          where: {
            organizationId: ctx.organizationId,
          },
        })
        for (const bill of bills) {
          const billMetadata = (bill.metadata as any) || {}
          const billDebitNotes = billMetadata.debitNotes || []
          const appliedToThisDN = billDebitNotes.filter((app: any) => app.debitNoteId === input.id)
          applications.push(...appliedToThisDN)
          totalApplied += appliedToThisDN.reduce((sum: number, app: any) => sum + (app.amount || 0), 0)
        }
      }

      const remaining = new Prisma.Decimal(debitNote.total.toString()).minus(new Prisma.Decimal(totalApplied))

      return {
        ...debitNote,
        totalApplied,
        remaining: remaining.toNumber(),
        applications,
      }
    }),

  /**
   * Create a debit note
   * 
   * If fromBillId provided: default lines from source bill items
   * Status = DRAFT, totals computed, currency matches bill
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(createDebitNoteBaseSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, fromBillId, vendorId, items, date, reason, notes, currency } = input

      let bill = null
      let debitNoteItems: Array<{
        description: string
        quantity: number
        unitPrice: number
        taxRate: number
      }> = []

      if (fromBillId) {
        // Fetch source bill
        bill = await prisma.bill.findUnique({
          where: {
            id: fromBillId,
            organizationId: ctx.organizationId,
          },
          include: { items: true, vendor: true },
        })

        if (!bill) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source bill not found",
          })
        }

        // Verify vendor matches
        if (bill.vendorId !== vendorId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Vendor ID must match the bill's vendor",
          })
        }

        // Default items from bill
        debitNoteItems = bill.items.map((item) => ({
          description: item.description,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          taxRate: item.taxRate.toNumber(),
        }))
      } else if (items) {
        // Manual creation with provided items
        debitNoteItems = items
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either fromBillId or items must be provided",
        })
      }

      if (debitNoteItems.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debit note must have at least one item",
        })
      }

      const totals = calculateDebitNoteTotals(debitNoteItems)

      // Generate debit note number
      const debitNoteNumber = await generateDebitNoteNumber(ctx.organizationId)

      // Use bill currency if from bill, otherwise use provided currency
      const finalCurrency = bill ? bill.currency : (currency || "GBP")

      // Create debit note
      const debitNote = await prisma.debitNote.create({
        data: {
          organizationId: ctx.organizationId,
          billId: bill?.id || null,
          vendorId,
          debitNoteNumber,
          date: typeof date === "string" ? new Date(date) : date,
          reason: reason || undefined,
          notes: notes || undefined,
          currency: finalCurrency,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          status: DebitNoteStatus.DRAFT,
          items: {
            create: debitNoteItems.map((item) => ({
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              total: new Prisma.Decimal(item.quantity * item.unitPrice * (1 + item.taxRate / 100)),
              taxRate: new Prisma.Decimal(item.taxRate),
            })),
          },
        },
        include: {
          bill: {
            include: {
              vendor: true,
            },
          },
          vendor: true,
          items: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "debitNote",
        entityId: debitNote.id,
        action: "create",
        after: debitNote,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          debitNoteNumber: debitNote.debitNoteNumber,
          fromBillId,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, debitNoteId: debitNote.id })
      })

      return debitNote
    }),

  /**
   * Apply a debit note to a bill
   * Allows partial application and tracks remaining balance.
   * Postings: DR AP, CR Expense Returns/Adjustments
   */
  apply: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_EDIT))
    .input(z.object({
      id: z.string().min(1, "Debit Note ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      targetBillId: z.string().min(1, "Target Bill ID is required"),
      amount: z.number().min(0.01, "Amount to apply must be greater than 0"),
      idempotencyKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("debitNote", input.id, ctx.organizationId)

      // Get debit note
      const debitNote = await prisma.debitNote.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      })

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        })
      }

      // Cannot apply if cancelled
      if (debitNote.status === DebitNoteStatus.CANCELLED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot apply a cancelled debit note",
        })
      }

      // Calculate current applied amount
      // Get from notes field first (faster), then fallback to querying bills
      let totalApplied = 0
      let applications: any[] = []
      
      try {
        const notesData = debitNote.notes ? JSON.parse(debitNote.notes) : {}
        if (notesData.applications) {
          applications = notesData.applications
          totalApplied = notesData.totalApplied || 0
        } else {
          // Fallback: query all bills
          const bills = await prisma.bill.findMany({
            where: {
              organizationId: ctx.organizationId,
            },
          })
          for (const bill of bills) {
            const billMetadata = (bill.metadata as any) || {}
            const billDebitNotes = billMetadata.debitNotes || []
            const appliedToThisDN = billDebitNotes.filter((app: any) => app.debitNoteId === input.id)
            applications.push(...appliedToThisDN)
            totalApplied += appliedToThisDN.reduce((sum: number, app: any) => sum + (app.amount || 0), 0)
          }
        }
      } catch {
        // If notes parsing fails, query bills
        const bills = await prisma.bill.findMany({
          where: {
            organizationId: ctx.organizationId,
          },
        })
        for (const bill of bills) {
          const billMetadata = (bill.metadata as any) || {}
          const billDebitNotes = billMetadata.debitNotes || []
          const appliedToThisDN = billDebitNotes.filter((app: any) => app.debitNoteId === input.id)
          applications.push(...appliedToThisDN)
          totalApplied += appliedToThisDN.reduce((sum: number, app: any) => sum + (app.amount || 0), 0)
        }
      }

      const debitNoteTotal = new Prisma.Decimal(debitNote.total.toString())
      const appliedAmount = new Prisma.Decimal(totalApplied)
      const remainingAmount = debitNoteTotal.minus(appliedAmount)
      const applyAmount = new Prisma.Decimal(input.amount)

      // Prevent over-application
      if (applyAmount.greaterThan(remainingAmount)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot apply ${applyAmount.toFixed(2)}. Amount exceeds remaining balance of ${remainingAmount.toFixed(2)}`,
        })
      }

      // Get target bill
      const targetBill = await prisma.bill.findUnique({
        where: {
          id: input.targetBillId,
          organizationId: ctx.organizationId,
        },
        include: {
          vendor: true,
          payments: {
            where: {
              status: { in: ["COMPLETED", "PROCESSING"] },
            },
          },
          debitNotes: {
            where: {
              status: DebitNoteStatus.APPLIED,
            },
          },
        },
      })

      if (!targetBill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Target bill ${input.targetBillId} not found`,
        })
      }

      // Verify vendor matches
      if (targetBill.vendorId !== debitNote.vendorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Target bill vendor must match debit note vendor",
        })
      }

      // Calculate bill balance (total - payments - debit notes applied)
      const totalPaid = targetBill.payments.reduce(
        (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
        new Prisma.Decimal(0)
      )

      // Calculate debit notes applied to this bill from bill metadata
      const billMetadata = (targetBill.metadata as any) || {}
      const billDebitNotes = billMetadata.debitNotes || []
      const debitNotesApplied = billDebitNotes.reduce(
        (sum: Prisma.Decimal, app: any) => sum.plus(new Prisma.Decimal(app.amount || 0)),
        new Prisma.Decimal(0)
      )

      const billTotal = new Prisma.Decimal(targetBill.total.toString())
      const billBalance = billTotal.minus(totalPaid).minus(debitNotesApplied)

      // Prevent over-application to bill
      if (applyAmount.greaterThan(billBalance)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot apply ${applyAmount.toFixed(2)}. Bill balance is only ${billBalance.toFixed(2)}`,
        })
      }

      // Get accounts for posting
      const apAccount = await getAPAccount(ctx.organizationId)
      const expenseReturnsAccount = await getExpenseReturnsAccount(ctx.organizationId)

      // Process in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Calculate new totals
        const newTotalApplied = totalApplied + applyAmount.toNumber()
        const newRemaining = debitNoteTotal.minus(new Prisma.Decimal(newTotalApplied))

      // Update debit note status
      // Store application tracking in notes field as JSON (since metadata field doesn't exist)
      const currentNotes = debitNote.notes || ""
      let notesData: any = {}
      try {
        // Try to parse existing notes as JSON
        if (currentNotes && currentNotes.trim().startsWith("{")) {
          notesData = JSON.parse(currentNotes)
        } else {
          // Keep original notes and add tracking
          notesData = { originalNotes: currentNotes || "" }
        }
      } catch {
        // If parsing fails, keep original notes
        notesData = { originalNotes: currentNotes || "" }
      }

      // Add application to tracking
      if (!notesData.applications) {
        notesData.applications = []
      }
      notesData.applications.push({
        billId: input.targetBillId,
        amount: applyAmount.toNumber(),
        appliedAt: new Date().toISOString(),
      })
      notesData.totalApplied = newTotalApplied
      notesData.remaining = newRemaining.toNumber()

      // Update debit note
      const updatedDebitNote = await tx.debitNote.update({
        where: { id: input.id },
        data: {
          status: newRemaining.lessThanOrEqualTo(0.01) ? DebitNoteStatus.APPLIED : DebitNoteStatus.SENT,
          notes: JSON.stringify(notesData),
        },
      })

        // Post double-entry: DR AP, CR Expense Returns
        const journalLines: JournalLine[] = [
          {
            accountId: apAccount.id,
            debit: applyAmount.toNumber(),
            credit: 0,
            description: `Debit note ${debitNote.debitNoteNumber} applied to bill ${targetBill.billNumber}`,
            reference: debitNote.debitNoteNumber,
            metadata: {
              debitNoteId: input.id,
              billId: input.targetBillId,
              vendorId: debitNote.vendorId,
            },
          },
          {
            accountId: expenseReturnsAccount.id,
            debit: 0,
            credit: applyAmount.toNumber(),
            description: `Debit note ${debitNote.debitNoteNumber} applied to bill ${targetBill.billNumber}`,
            reference: debitNote.debitNoteNumber,
            metadata: {
              debitNoteId: input.id,
              billId: input.targetBillId,
              vendorId: debitNote.vendorId,
            },
          },
        ]

        const postingResult = await postDoubleEntry({
          date: new Date(),
          lines: journalLines,
          docRef: debitNote.debitNoteNumber,
          currency: debitNote.currency,
          rate: 1.0,
          orgId: ctx.organizationId,
          userId: ctx.session.user.id,
          description: `Debit note application: ${debitNote.debitNoteNumber}`,
          metadata: {
            debitNoteId: input.id,
            billId: input.targetBillId,
            amount: applyAmount.toNumber(),
          },
        })

        // Update bill balance in metadata
        const billMetadata = (targetBill.metadata as any) || {}
        if (!billMetadata.debitNotes) {
          billMetadata.debitNotes = []
        }
        billMetadata.debitNotes.push({
          debitNoteId: input.id,
          debitNoteNumber: debitNote.debitNoteNumber,
          amount: applyAmount.toNumber(),
          appliedAt: new Date().toISOString(),
        })

        const newBillBalance = billBalance.minus(applyAmount)

        // Update bill status if fully paid/adjusted
        let newBillStatus = targetBill.status
        if (newBillBalance.lessThanOrEqualTo(0)) {
          newBillStatus = BillStatus.PAID
        } else if (newBillBalance.lessThan(billTotal) && billBalance.equals(billTotal)) {
          // First payment/adjustment
          newBillStatus = BillStatus.PART_PAID
        }

        await tx.bill.update({
          where: { id: input.targetBillId },
          data: {
            status: newBillStatus,
            metadata: {
              ...billMetadata,
              debitNotes: billDebitNotes,
              balance: newBillBalance.toNumber(),
            },
          },
        })

        return {
          debitNote: updatedDebitNote,
          bill: await tx.bill.findUnique({
            where: { id: input.targetBillId },
            include: { vendor: true },
          }),
          posting: postingResult,
        }
      })

      // Record audit
      await recordAudit({
        entity: "debitNote",
        entityId: input.id,
        action: "apply",
        before: debitNote,
        after: result.debitNote,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          targetBillId: input.targetBillId,
          amount: applyAmount.toNumber(),
          idempotencyKey: input.idempotencyKey,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, debitNoteId: input.id })
      })

      return result
    }),

  /**
   * Cancel a debit note
   * Only allowed if not yet applied.
   */
  cancel: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_DELETE))
    .input(z.object({
      id: z.string().min(1, "Debit Note ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("debitNote", input.id, ctx.organizationId)

      // Get debit note
      const debitNote = await prisma.debitNote.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      })

      if (!debitNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Debit note not found",
        })
      }

      // Cannot cancel if already applied
      // Check applications from notes field
      let hasApplications = false
      try {
        const notesData = debitNote.notes ? JSON.parse(debitNote.notes) : {}
        if (notesData.applications && notesData.applications.length > 0) {
          hasApplications = true
        }
      } catch {
        // If notes is not JSON, check status
        hasApplications = debitNote.status === DebitNoteStatus.APPLIED
      }

      if (hasApplications || debitNote.status === DebitNoteStatus.APPLIED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot cancel a debit note that has been applied. Reverse applications first.",
        })
      }

      // Update status
      const updatedDebitNote = await prisma.debitNote.update({
        where: { id: input.id },
        data: {
          status: DebitNoteStatus.CANCELLED,
          // Store cancellation info in notes
          notes: JSON.stringify({
            originalNotes: debitNote.notes || "",
            cancelledAt: new Date().toISOString(),
            cancelledBy: ctx.session.user.id,
            cancellationReason: input.reason || undefined,
          }),
        },
        include: {
          bill: {
            include: {
              vendor: true,
            },
          },
          vendor: true,
          items: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "debitNote",
        entityId: input.id,
        action: "cancel",
        before: debitNote,
        after: updatedDebitNote,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          reason: input.reason,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, debitNoteId: input.id })
      })

      return updatedDebitNote
    }),
})

