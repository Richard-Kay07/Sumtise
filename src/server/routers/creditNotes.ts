/**
 * Credit Notes Router
 * 
 * Handles credit notes for sales invoices with:
 * - Create from invoice or manual
 * - Apply to invoices (partial or full)
 * - Cancel credit notes
 * - Ledger postings (DR Revenue Returns, CR AR)
 * - Invoice balance adjustments
 * - Application ledger tracking
 * - On-account credit support
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema, createCreditNoteSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { postDoubleEntry, type JournalLine } from "@/lib/posting"
import Decimal from "decimal.js"
import { CreditNoteStatus, InvoiceStatus } from "@prisma/client"

/**
 * Credit note list query schema with filters
 */
const creditNoteListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  invoiceId: z.string().optional(),
  status: z.enum(["DRAFT", "SENT", "APPLIED", "CANCELLED"]).optional(),
  // Date range filters
  dateFrom: z.union([z.date(), z.string()]).optional(),
  dateTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["date", "total", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Calculate credit note totals from items
 */
function calculateCreditNoteTotals(items: Array<{
  quantity: number
  unitPrice: number
  taxRate: number
}>): { subtotal: Decimal; taxAmount: Decimal; total: Decimal } {
  let subtotal = new Decimal(0)
  let taxAmount = new Decimal(0)

  for (const item of items) {
    const lineSubtotal = new Decimal(item.quantity).times(new Decimal(item.unitPrice))
    const lineTax = lineSubtotal.times(new Decimal(item.taxRate).div(100))
    subtotal = subtotal.plus(lineSubtotal)
    taxAmount = taxAmount.plus(lineTax)
  }

  const total = subtotal.plus(taxAmount)

  return { subtotal, taxAmount, total }
}

/**
 * Generate unique credit note number
 */
async function generateCreditNoteNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CN-${year}-`

  // Find the highest credit note number for this year
  const lastCreditNote = await prisma.creditNote.findFirst({
    where: {
      organizationId,
      creditNoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      creditNoteNumber: "desc",
    },
  })

  if (!lastCreditNote) {
    return `${prefix}001`
  }

  // Extract number and increment
  const lastNumber = parseInt(lastCreditNote.creditNoteNumber.replace(prefix, ""), 10)
  const nextNumber = (lastNumber + 1).toString().padStart(3, "0")

  return `${prefix}${nextNumber}`
}

/**
 * Get AR (Accounts Receivable) control account
 */
async function getARAccount(organizationId: string) {
  // Try to find AR account by code (common codes: 1200, 1300, 12000)
  const arAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "ASSET",
      code: { in: ["1200", "1300", "12000"] },
      isActive: true,
    },
  })

  if (arAccount) {
    return arAccount
  }

  // Fallback: find any ASSET account with "receivable" in name
  const fallbackAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "ASSET",
      name: { contains: "receivable", mode: "insensitive" },
      isActive: true,
    },
  })

  if (!fallbackAccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Accounts Receivable control account not found. Please set up chart of accounts.",
    })
  }

  return fallbackAccount
}

/**
 * Get Revenue Returns/Adjustments account
 */
async function getRevenueReturnsAccount(organizationId: string) {
  // Try to find Revenue Returns account by code or name
  const revenueReturnsAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "REVENUE",
      OR: [
        { code: { in: ["4300", "4400", "43000"] } },
        { name: { contains: "returns", mode: "insensitive" } },
        { name: { contains: "adjustments", mode: "insensitive" } },
        { name: { contains: "credit", mode: "insensitive" } },
      ],
      isActive: true,
    },
  })

  if (revenueReturnsAccount) {
    return revenueReturnsAccount
  }

  // Fallback: use first revenue account if returns account not found
  const fallbackAccount = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      type: "REVENUE",
      isActive: true,
    },
  })

  if (!fallbackAccount) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Revenue Returns/Adjustments account not found. Please set up chart of accounts.",
    })
  }

  return fallbackAccount
}

export const creditNotesRouter = createTRPCRouter({
  /**
   * Get all credit notes with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.CREDIT_NOTES_VIEW))
    .input(creditNoteListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        invoiceId,
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
      if (invoiceId) {
        where.invoiceId = invoiceId
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
      const [creditNotes, total] = await Promise.all([
        prisma.creditNote.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            items: true,
          },
        }),
        prisma.creditNote.count({ where }),
      ])

      // Calculate applied amount and remaining balance for each credit note
      const creditNotesWithBalance = creditNotes.map((cn) => {
        const metadata = cn.metadata as any || {}
        const applications = metadata.applications || []
        const totalApplied = applications.reduce(
          (sum: number, app: any) => sum + (app.amount || 0),
          0
        )
        const remaining = new Decimal(cn.total.toString()).minus(new Decimal(totalApplied))

        return {
          ...cn,
          totalApplied,
          remaining: remaining.toNumber(),
        }
      })

      return {
        creditNotes: creditNotesWithBalance,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get credit note by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.CREDIT_NOTES_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("creditNote", input.id, ctx.organizationId)

      const creditNote = await prisma.creditNote.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          invoice: {
            include: {
              customer: true,
              items: true,
            },
          },
          items: true,
        },
      })

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        })
      }

      // Calculate applied amount and remaining balance
      const metadata = creditNote.metadata as any || {}
      const applications = metadata.applications || []
      const totalApplied = applications.reduce(
        (sum: number, app: any) => sum + (app.amount || 0),
        0
      )
      const remaining = new Decimal(creditNote.total.toString()).minus(new Decimal(totalApplied))

      return {
        ...creditNote,
        totalApplied,
        remaining: remaining.toNumber(),
        applications,
      }
    }),

  /**
   * Create a credit note
   * 
   * If fromInvoiceId provided: default lines from source invoice items
   * Status = DRAFT, totals computed, currency matches invoice
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.CREDIT_NOTES_CREATE))
    .input(createCreditNoteSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const {
        organizationId,
        fromInvoiceId,
        date,
        reason,
        notes,
        currency,
        items: manualItems,
      } = input

      let invoice: any = null
      let creditNoteItems: Array<{
        description: string
        quantity: number
        unitPrice: number
        taxRate: number
      }> = []

      if (fromInvoiceId) {
        // Get source invoice
        invoice = await prisma.invoice.findUnique({
          where: {
            id: fromInvoiceId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: true,
            customer: true,
          },
        })

        if (!invoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Source invoice not found",
          })
        }

        // Default lines from invoice items
        creditNoteItems = invoice.items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          taxRate: item.taxRate.toNumber(),
        }))

        // Use invoice currency
        const invoiceCurrency = invoice.currency || "GBP"
        if (currency && currency !== invoiceCurrency) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Credit note currency must match invoice currency (${invoiceCurrency})`,
          })
        }
      } else if (manualItems && manualItems.length > 0) {
        // Manual creation
        creditNoteItems = manualItems
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either fromInvoiceId or items must be provided",
        })
      }

      // Calculate totals
      const totals = calculateCreditNoteTotals(creditNoteItems)

      // Generate credit note number
      const creditNoteNumber = await generateCreditNoteNumber(ctx.organizationId)

      // For manual creation, we still need an invoiceId (required by schema)
      // If no fromInvoiceId provided, we need to get a customer's invoice or create a placeholder
      // For now, we'll require fromInvoiceId or throw an error for manual creation
      if (!invoice && !fromInvoiceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "fromInvoiceId is required. Manual credit notes must be linked to a source invoice.",
        })
      }

      // Use invoice currency if from invoice, otherwise use provided currency
      const finalCurrency = invoice ? invoice.currency : (currency || "GBP")

      // Create credit note
      const creditNote = await prisma.creditNote.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: invoice!.id, // Required field, use source invoice
          creditNoteNumber,
          date: typeof date === "string" ? new Date(date) : date,
          reason: reason || undefined,
          notes: notes || undefined,
          currency: finalCurrency,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          status: CreditNoteStatus.DRAFT,
          items: {
            create: creditNoteItems.map((item) => ({
              description: item.description,
              quantity: new Decimal(item.quantity),
              unitPrice: new Decimal(item.unitPrice),
              total: new Decimal(item.quantity * item.unitPrice * (1 + item.taxRate / 100)),
              taxRate: new Decimal(item.taxRate),
            })),
          },
        },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
          items: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "creditNote",
        entityId: creditNote.id,
        action: "create",
        after: creditNote,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          creditNoteNumber: creditNote.creditNoteNumber,
          fromInvoiceId: invoice?.id,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, creditNoteId: creditNote.id })
      })

      return creditNote
    }),

  /**
   * Apply credit note to invoice(s)
   * 
   * Post DR Revenue Returns/Adjustments, CR AR
   * Reduce invoice balance
   * Allow remainder as on-account credit
   * Prevent over-application
   * Support partial applications
   * Maintain application ledger
   */
  apply: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.CREDIT_NOTES_EDIT))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      targetInvoiceId: z.string().optional(), // Target invoice to apply to
      amount: z.number().optional(), // Amount to apply (if not specified, apply full remaining)
      applyToMultiple: z.array(z.object({
        invoiceId: z.string(),
        amount: z.number(),
      })).optional(), // Apply to multiple invoices
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("creditNote", input.id, ctx.organizationId)

      // Get credit note
      const creditNote = await prisma.creditNote.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
          items: true,
        },
      })

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        })
      }

      // Cannot apply if cancelled
      if (creditNote.status === CreditNoteStatus.CANCELLED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot apply a cancelled credit note",
        })
      }

      // Calculate remaining balance
      const metadata = creditNote.metadata as any || {}
      const applications = metadata.applications || []
      const totalApplied = applications.reduce(
        (sum: number, app: any) => sum + (app.amount || 0),
        0
      )
      const creditNoteTotal = new Decimal(creditNote.total.toString())
      const remaining = creditNoteTotal.minus(new Decimal(totalApplied))

      if (remaining.lessThanOrEqualTo(0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Credit note has already been fully applied",
        })
      }

      // Determine application targets
      let applicationTargets: Array<{ invoiceId: string; amount: Decimal }> = []

      if (input.applyToMultiple && input.applyToMultiple.length > 0) {
        // Apply to multiple invoices
        applicationTargets = input.applyToMultiple.map((target) => ({
          invoiceId: target.invoiceId,
          amount: new Decimal(target.amount),
        }))
      } else if (input.targetInvoiceId) {
        // Apply to single invoice
        const amount = input.amount 
          ? new Decimal(input.amount)
          : remaining // Apply full remaining if amount not specified
        applicationTargets = [{ invoiceId: input.targetInvoiceId, amount }]
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Either targetInvoiceId or applyToMultiple must be provided",
        })
      }

      // Validate total application amount doesn't exceed remaining
      const totalToApply = applicationTargets.reduce(
        (sum, target) => sum.plus(target.amount),
        new Decimal(0)
      )

      if (totalToApply.greaterThan(remaining)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Total application amount (${totalToApply.toNumber()}) exceeds remaining credit note balance (${remaining.toNumber()})`,
        })
      }

      // Get accounts for posting
      const arAccount = await getARAccount(ctx.organizationId)
      const revenueReturnsAccount = await getRevenueReturnsAccount(ctx.organizationId)

      // Process applications in transaction
      const result = await prisma.$transaction(async (tx) => {
        const newApplications: Array<{
          invoiceId: string
          amount: number
          appliedAt: string
        }> = []

        // Process each application
        for (const target of applicationTargets) {
          // Get target invoice
          const targetInvoice = await tx.invoice.findUnique({
            where: {
              id: target.invoiceId,
              organizationId: ctx.organizationId,
            },
            include: {
              customer: true,
            },
          })

          if (!targetInvoice) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `Target invoice ${target.invoiceId} not found`,
            })
          }

          // Calculate invoice balance (total - all credit notes applied to this invoice)
          // Get all credit notes that have been applied to this invoice
          const allCreditNotes = await tx.creditNote.findMany({
            where: {
              organizationId: ctx.organizationId,
              status: { in: [CreditNoteStatus.APPLIED, CreditNoteStatus.SENT, CreditNoteStatus.DRAFT] },
            },
          })

          const creditNotesApplied = allCreditNotes.reduce(
            (sum, cn) => {
              const cnMetadata = cn.metadata as any || {}
              const cnApplications = cnMetadata.applications || []
              const cnAppliedToThisInvoice = cnApplications
                .filter((app: any) => app.invoiceId === target.invoiceId)
                .reduce((s: number, app: any) => s + (app.amount || 0), 0)
              return sum.plus(new Decimal(cnAppliedToThisInvoice))
            },
            new Decimal(0)
          )

          const invoiceTotal = new Decimal(targetInvoice.total.toString())
          const invoiceBalance = invoiceTotal.minus(creditNotesApplied)

          // Prevent over-application
          if (target.amount.greaterThan(invoiceBalance)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Application amount (${target.amount.toNumber()}) exceeds invoice balance (${invoiceBalance.toNumber()})`,
            })
          }

          // Create ledger postings (DR Revenue Returns, CR AR)
          const journalLines: JournalLine[] = [
            {
              accountId: revenueReturnsAccount.id,
              debit: target.amount.toNumber(),
              credit: 0,
              description: `Credit note ${creditNote.creditNoteNumber} applied to invoice ${targetInvoice.invoiceNumber}`,
              reference: creditNote.creditNoteNumber,
              metadata: {
                creditNoteId: creditNote.id,
                invoiceId: targetInvoice.id,
                applicationType: "credit_note_application",
              },
            },
            {
              accountId: arAccount.id,
              debit: 0,
              credit: target.amount.toNumber(),
              description: `Credit note ${creditNote.creditNoteNumber} - AR reduction`,
              reference: creditNote.creditNoteNumber,
              metadata: {
                creditNoteId: creditNote.id,
                invoiceId: targetInvoice.id,
                applicationType: "credit_note_application",
              },
            },
          ]

          await postDoubleEntry({
            date: new Date(),
            lines: journalLines,
            docRef: `CN-${creditNote.creditNoteNumber}`,
            currency: creditNote.currency,
            rate: 1.0,
            orgId: ctx.organizationId,
            userId: ctx.session.user.id,
            description: `Credit note ${creditNote.creditNoteNumber} applied to invoice ${targetInvoice.invoiceNumber}`,
            metadata: {
              creditNoteId: creditNote.id,
              invoiceId: targetInvoice.id,
            },
          })

          // Record application
          newApplications.push({
            invoiceId: targetInvoice.id,
            amount: target.amount.toNumber(),
            appliedAt: new Date().toISOString(),
          })
        }

        // Update credit note with applications
        const updatedApplications = [...applications, ...newApplications]
        const newTotalApplied = updatedApplications.reduce(
          (sum, app) => sum + (app.amount || 0),
          0
        )
        const newRemaining = creditNoteTotal.minus(new Decimal(newTotalApplied))

        // Update status to APPLIED if fully applied
        let newStatus = creditNote.status
        if (newRemaining.lessThanOrEqualTo(0.01)) {
          newStatus = CreditNoteStatus.APPLIED
        } else if (newTotalApplied > 0) {
          // Partially applied - keep as DRAFT or SENT, but track in metadata
          newStatus = creditNote.status === CreditNoteStatus.DRAFT 
            ? CreditNoteStatus.DRAFT 
            : CreditNoteStatus.SENT
        }

        const updatedCreditNote = await tx.creditNote.update({
          where: { id: input.id },
          data: {
            status: newStatus,
            metadata: {
              ...metadata,
              applications: updatedApplications,
              totalApplied: newTotalApplied,
              remaining: newRemaining.toNumber(),
              lastAppliedAt: new Date().toISOString(),
            },
          },
        })

        return {
          creditNote: updatedCreditNote,
          applications: newApplications,
          totalApplied: newTotalApplied,
          remaining: newRemaining.toNumber(),
        }
      })

      // Record audit
      await recordAudit({
        entity: "creditNote",
        entityId: input.id,
        action: "apply",
        before: creditNote,
        after: result.creditNote,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          applications: result.applications,
          totalApplied: result.totalApplied,
          remaining: result.remaining,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, creditNoteId: input.id })
      })

      // Return updated credit note
      return await prisma.creditNote.findUnique({
        where: { id: input.id },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
          items: true,
        },
      })
    }),

  /**
   * Cancel a credit note
   * 
   * Only allowed if not applied
   */
  cancel: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.CREDIT_NOTES_DELETE))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("creditNote", input.id, ctx.organizationId)

      // Get credit note
      const creditNote = await prisma.creditNote.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      })

      if (!creditNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit note not found",
        })
      }

      // Cannot cancel if already cancelled
      if (creditNote.status === CreditNoteStatus.CANCELLED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Credit note is already cancelled",
        })
      }

      // Cannot cancel if applied
      const metadata = creditNote.metadata as any || {}
      const applications = metadata.applications || []
      const totalApplied = applications.reduce(
        (sum: number, app: any) => sum + (app.amount || 0),
        0
      )

      if (totalApplied > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot cancel credit note that has been applied. Reverse applications first.",
        })
      }

      // Cancel credit note
      const cancelledCreditNote = await prisma.creditNote.update({
        where: { id: input.id },
        data: {
          status: CreditNoteStatus.CANCELLED,
          metadata: {
            ...metadata,
            cancelledAt: new Date().toISOString(),
            cancelledBy: ctx.session.user.id,
            cancellationReason: input.reason || undefined,
          },
        },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
          items: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "creditNote",
        entityId: input.id,
        action: "cancel",
        before: creditNote,
        after: cancelledCreditNote,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          reason: input.reason || undefined,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, creditNoteId: input.id })
      })

      return cancelledCreditNote
    }),
})

