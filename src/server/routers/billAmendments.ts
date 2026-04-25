/**
 * Bill Amendments Router
 * 
 * Handles controlled edits to posted bills with:
 * - Amendment creation with before/after snapshots
 * - Approval workflow
 * - Bill locking during amendment process
 * - Automatic adjustment journal generation for financial changes
 * - Full audit trail
 * - Bill balance updates
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { postDoubleEntry, type JournalLine } from "@/lib/posting"
import { Prisma, AmendmentType, AmendmentStatus, BillStatus, AccountType } from "@prisma/client"

/**
 * Amendment list query schema with filters
 */
const amendmentListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  billId: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  amendmentType: z.enum(["AMOUNT_CHANGE", "DATE_CHANGE", "VENDOR_CHANGE", "ITEM_CHANGE", "STATUS_CHANGE", "OTHER"]).optional(),
  // Date range filters
  createdAtFrom: z.union([z.date(), z.string()]).optional(),
  createdAtTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["createdAt", "approvedAt", "amendmentType"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Calculate bill totals from items
 */
function calculateBillTotals(items: Array<{
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
 * Detect if amendment has financial impact
 */
function hasFinancialImpact(originalData: any, amendedData: any): boolean {
  // Check amount changes
  const originalTotal = new Prisma.Decimal(originalData.total || 0)
  const amendedTotal = new Prisma.Decimal(amendedData.total || 0)
  if (!originalTotal.equals(amendedTotal)) {
    return true
  }

  // Check tax changes
  const originalTax = new Prisma.Decimal(originalData.taxAmount || 0)
  const amendedTax = new Prisma.Decimal(amendedData.taxAmount || 0)
  if (!originalTax.equals(amendedTax)) {
    return true
  }

  // Check account changes in items
  const originalItems = originalData.items || []
  const amendedItems = amendedData.items || []
  
  if (originalItems.length !== amendedItems.length) {
    return true
  }

  for (let i = 0; i < originalItems.length; i++) {
    const origItem = originalItems[i]
    const amendItem = amendedItems[i]
    
    // Check account ID changes
    if (origItem.accountId !== amendItem.accountId) {
      return true
    }
    
    // Check amount changes per item
    const origItemTotal = new Prisma.Decimal(origItem.total || origItem.quantity * origItem.unitPrice || 0)
    const amendItemTotal = new Prisma.Decimal(amendItem.total || amendItem.quantity * amendItem.unitPrice || 0)
    if (!origItemTotal.equals(amendItemTotal)) {
      return true
    }
  }

  return false
}

/**
 * Get AP (Accounts Payable) control account
 */
async function getAPAccount(organizationId: string) {
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
 * Lock bill for amendment (prevent direct edits)
 */
async function lockBillForAmendment(billId: string, organizationId: string, amendmentId: string) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId, organizationId },
  })

  if (!bill) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Bill not found",
    })
  }

  const metadata = (bill.metadata as any) || {}
  await prisma.bill.update({
    where: { id: billId },
    data: {
      metadata: {
        ...metadata,
        lockedForAmendment: true,
        pendingAmendmentId: amendmentId,
        lockedAt: new Date().toISOString(),
      },
    },
  })
}

/**
 * Unlock bill after amendment resolution
 */
async function unlockBill(billId: string, organizationId: string) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId, organizationId },
  })

  if (!bill) {
    return
  }

  const metadata = (bill.metadata as any) || {}
  const { lockedForAmendment, pendingAmendmentId, lockedAt, ...restMetadata } = metadata

  await prisma.bill.update({
    where: { id: billId },
    data: {
      metadata: {
        ...restMetadata,
      },
    },
  })
}

export const billAmendmentsRouter = createTRPCRouter({
  /**
   * Get all amendments with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(amendmentListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        billId,
        status,
        amendmentType,
        createdAtFrom,
        createdAtTo,
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

      if (status) {
        where.status = status
      }

      if (amendmentType) {
        where.amendmentType = amendmentType
      }

      // Date range filter
      if (createdAtFrom || createdAtTo) {
        where.createdAt = {}
        if (createdAtFrom) {
          const from = typeof createdAtFrom === "string" ? new Date(createdAtFrom) : createdAtFrom
          where.createdAt.gte = from
        }
        if (createdAtTo) {
          const to = typeof createdAtTo === "string" ? new Date(createdAtTo) : createdAtTo
          to.setHours(23, 59, 59, 999)
          where.createdAt.lte = to
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
      const [amendments, total] = await Promise.all([
        prisma.billAmendment.findMany({
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
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.billAmendment.count({ where }),
      ])

      return {
        amendments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get amendment by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      const amendment = await prisma.billAmendment.findUnique({
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
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      if (!amendment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Amendment not found",
        })
      }

      return amendment
    }),

  /**
   * Get amendment history for a bill
   */
  getHistory: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(z.object({
      billId: z.string().min(1, "Bill ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Verify bill ownership
      await verifyResourceOwnership("bill", input.billId, ctx.organizationId)

      const amendments = await prisma.billAmendment.findMany({
        where: {
          billId: input.billId,
          organizationId: ctx.organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      return amendments
    }),

  /**
   * Create a bill amendment
   * 
   * Stores before/after snapshots, locks bill from direct edits, status PENDING
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_EDIT))
    .input(z.object({
      organizationId: z.string().min(1),
      billId: z.string().min(1),
      amendmentType: z.enum(["AMOUNT_CHANGE", "DATE_CHANGE", "VENDOR_CHANGE", "ITEM_CHANGE", "STATUS_CHANGE", "OTHER"]),
      reason: z.string().min(1, "Reason is required"),
      // Patch data - what to change
      patch: z.object({
        date: z.date().optional(),
        dueDate: z.date().optional(),
        vendorId: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        items: z.array(z.object({
          id: z.string().optional(), // Existing item ID for updates
          description: z.string().min(1),
          quantity: z.number().min(0),
          unitPrice: z.number().min(0),
          taxRate: z.number().min(0).max(100).default(0),
          accountId: z.string().optional(),
          taxCodeId: z.string().optional(),
          lineMemo: z.string().optional(),
        })).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { billId, amendmentType, reason, patch } = input

      // Verify bill ownership
      await verifyResourceOwnership("bill", billId, ctx.organizationId)

      // Get current bill state
      const bill = await prisma.bill.findUnique({
        where: {
          id: billId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: true,
          vendor: true,
          payments: {
            where: {
              status: { in: ["COMPLETED", "PROCESSING"] },
            },
          },
        },
      })

      if (!bill) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        })
      }

      // Check if bill is locked for another amendment
      const metadata = (bill.metadata as any) || {}
      if (metadata.lockedForAmendment && metadata.pendingAmendmentId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bill is locked for amendment ${metadata.pendingAmendmentId}. Please resolve that amendment first.`,
        })
      }

      // Check if bill can be amended
      // For paid bills with zero balance, only allow memo/notes updates
      const totalPaid = bill.payments.reduce(
        (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
        new Prisma.Decimal(0)
      )
      const billBalance = new Prisma.Decimal(bill.total.toString()).minus(totalPaid)

      if (billBalance.lessThanOrEqualTo(0) && bill.status === BillStatus.PAID) {
        // Only allow non-financial changes
        const hasFinancialChanges = 
          patch.items !== undefined ||
          patch.vendorId !== undefined ||
          (patch.date !== undefined && patch.date.getTime() !== bill.date.getTime())

        if (hasFinancialChanges) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cannot amend financial fields of a paid bill with zero balance. Only memo/notes updates allowed.",
          })
        }
      }

      // Prepare original data snapshot
      const originalData = {
        date: bill.date,
        dueDate: bill.dueDate,
        vendorId: bill.vendorId,
        notes: bill.notes,
        tags: bill.tags,
        subtotal: bill.subtotal.toNumber(),
        taxAmount: bill.taxAmount.toNumber(),
        total: bill.total.toNumber(),
        currency: bill.currency,
        items: bill.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          total: item.total.toNumber(),
          taxRate: item.taxRate.toNumber(),
          accountId: item.accountId,
          taxCodeId: item.taxCodeId,
          lineMemo: item.lineMemo,
        })),
      }

      // Prepare amended data
      let amendedData: any = {
        ...originalData,
      }

      // Apply patch
      if (patch.date !== undefined) {
        amendedData.date = patch.date
      }
      if (patch.dueDate !== undefined) {
        amendedData.dueDate = patch.dueDate
      }
      if (patch.vendorId !== undefined) {
        amendedData.vendorId = patch.vendorId
      }
      if (patch.notes !== undefined) {
        amendedData.notes = patch.notes
      }
      if (patch.tags !== undefined) {
        amendedData.tags = patch.tags
      }
      if (patch.items !== undefined) {
        // Recalculate totals for new items
        const totals = calculateBillTotals(patch.items)
        amendedData.items = patch.items
        amendedData.subtotal = totals.subtotal.toNumber()
        amendedData.taxAmount = totals.taxAmount.toNumber()
        amendedData.total = totals.total.toNumber()
      }

      // Create amendment
      const amendment = await prisma.billAmendment.create({
        data: {
          organizationId: ctx.organizationId,
          billId,
          userId: ctx.session.user.id,
          amendmentType: amendmentType as AmendmentType,
          reason,
          originalData,
          amendedData,
          status: AmendmentStatus.PENDING,
        },
        include: {
          bill: {
            include: {
              vendor: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Lock bill for amendment
      await lockBillForAmendment(billId, ctx.organizationId, amendment.id)

      // Record audit
      await recordAudit({
        entity: "billAmendment",
        entityId: amendment.id,
        action: "create",
        after: amendment,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          billId,
          amendmentType,
          reason,
          hasFinancialImpact: hasFinancialImpact(originalData, amendedData),
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, amendmentId: amendment.id })
      })

      return amendment
    }),

  /**
   * Approve a bill amendment
   * 
   * Applies changes to bill, generates adjustment journal if financial impact,
   * updates bill totals and outstanding balance
   */
  approve: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_EDIT))
    .input(z.object({
      id: z.string().min(1, "Amendment ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get amendment
      const amendment = await prisma.billAmendment.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          bill: {
            include: {
              items: true,
              vendor: true,
              payments: {
                where: {
                  status: { in: ["COMPLETED", "PROCESSING"] },
                },
              },
            },
          },
        },
      })

      if (!amendment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Amendment not found",
        })
      }

      if (amendment.status !== AmendmentStatus.PENDING) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Amendment is already ${amendment.status.toLowerCase()}`,
        })
      }

      const originalData = amendment.originalData as any
      const amendedData = amendment.amendedData as any
      const financialImpact = hasFinancialImpact(originalData, amendedData)

      // Process in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Apply changes to bill
        const updateData: any = {}

        if (amendedData.date) {
          updateData.date = typeof amendedData.date === "string" ? new Date(amendedData.date) : amendedData.date
        }
        if (amendedData.dueDate) {
          updateData.dueDate = typeof amendedData.dueDate === "string" ? new Date(amendedData.dueDate) : amendedData.dueDate
        }
        if (amendedData.vendorId && amendedData.vendorId !== originalData.vendorId) {
          updateData.vendorId = amendedData.vendorId
        }
        if (amendedData.notes !== undefined) {
          updateData.notes = amendedData.notes
        }
        if (amendedData.tags !== undefined) {
          updateData.tags = amendedData.tags
        }

        // Update items if changed
        if (amendedData.items) {
          // Delete existing items
          await tx.billItem.deleteMany({
            where: { billId: amendment.billId },
          })

          // Create new items
          updateData.subtotal = new Prisma.Decimal(amendedData.subtotal)
          updateData.taxAmount = new Prisma.Decimal(amendedData.taxAmount)
          updateData.total = new Prisma.Decimal(amendedData.total)

          await tx.bill.update({
            where: { id: amendment.billId },
            data: {
              ...updateData,
              items: {
                create: amendedData.items.map((item: any) => ({
                  description: item.description,
                  quantity: new Prisma.Decimal(item.quantity),
                  unitPrice: new Prisma.Decimal(item.unitPrice),
                  total: new Prisma.Decimal(item.quantity * item.unitPrice * (1 + (item.taxRate || 0) / 100)),
                  taxRate: new Prisma.Decimal(item.taxRate || 0),
                  accountId: item.accountId || undefined,
                  taxCodeId: item.taxCodeId || undefined,
                  lineMemo: item.lineMemo || undefined,
                })),
              },
            },
          })
        } else {
          // Just update bill fields
          await tx.bill.update({
            where: { id: amendment.billId },
            data: updateData,
          })
        }

        // Generate adjustment journal if financial impact
        let adjustmentJournal = null
        if (financialImpact) {
          const apAccount = await getAPAccount(ctx.organizationId)
          const originalTotal = new Prisma.Decimal(originalData.total || 0)
          const amendedTotal = new Prisma.Decimal(amendedData.total || 0)
          const difference = amendedTotal.minus(originalTotal)

          if (!difference.equals(0)) {
            // Create adjustment journal entries
            const journalLines: JournalLine[] = []

            // If items changed, reverse original and post new
            if (amendedData.items && originalData.items) {
              // Reverse original expense postings
              for (const origItem of originalData.items) {
                if (origItem.accountId) {
                  const origItemTotal = new Prisma.Decimal(origItem.total || origItem.quantity * origItem.unitPrice || 0)
                  journalLines.push({
                    accountId: origItem.accountId,
                    debit: 0,
                    credit: origItemTotal.toNumber(),
                    description: `Amendment reversal - Bill ${amendment.bill.billNumber}`,
                    reference: amendment.bill.billNumber,
                    metadata: {
                      amendmentId: input.id,
                      billId: amendment.billId,
                      itemId: origItem.id,
                    },
                  })
                }
              }

              // Post new expense postings
              for (const amendItem of amendedData.items) {
                if (amendItem.accountId) {
                  const amendItemTotal = new Prisma.Decimal(amendItem.total || amendItem.quantity * amendItem.unitPrice || 0)
                  journalLines.push({
                    accountId: amendItem.accountId,
                    debit: amendItemTotal.toNumber(),
                    credit: 0,
                    description: `Amendment - Bill ${amendment.bill.billNumber}`,
                    reference: amendment.bill.billNumber,
                    metadata: {
                      amendmentId: input.id,
                      billId: amendment.billId,
                    },
                  })
                }
              }

              // Adjust AP account
              journalLines.push({
                accountId: apAccount.id,
                debit: difference.greaterThan(0) ? difference.toNumber() : 0,
                credit: difference.lessThan(0) ? Math.abs(difference.toNumber()) : 0,
                description: `Amendment adjustment - Bill ${amendment.bill.billNumber}`,
                reference: amendment.bill.billNumber,
                metadata: {
                  amendmentId: input.id,
                  billId: amendment.billId,
                },
              })
            } else {
              // Simple amount adjustment
              journalLines.push({
                accountId: apAccount.id,
                debit: difference.greaterThan(0) ? difference.toNumber() : 0,
                credit: difference.lessThan(0) ? Math.abs(difference.toNumber()) : 0,
                description: `Amendment adjustment - Bill ${amendment.bill.billNumber}`,
                reference: amendment.bill.billNumber,
                metadata: {
                  amendmentId: input.id,
                  billId: amendment.billId,
                },
              })
            }

            // Post adjustment journal
            adjustmentJournal = await postDoubleEntry({
              date: new Date(),
              lines: journalLines,
              docRef: `AMEND-${amendment.bill.billNumber}`,
              currency: amendment.bill.currency,
              rate: 1.0,
              orgId: ctx.organizationId,
              userId: ctx.session.user.id,
              description: `Bill amendment adjustment: ${amendment.bill.billNumber}`,
              metadata: {
                amendmentId: input.id,
                billId: amendment.billId,
                originalTotal: originalTotal.toNumber(),
                amendedTotal: amendedTotal.toNumber(),
                difference: difference.toNumber(),
              },
            })
          }
        }

        // Update amendment status
        const updatedAmendment = await tx.billAmendment.update({
          where: { id: input.id },
          data: {
            status: AmendmentStatus.APPROVED,
            approvedBy: ctx.session.user.id,
            approvedAt: new Date(),
          },
        })

        // Unlock bill
        await unlockBill(amendment.billId, ctx.organizationId)

        // Get updated bill
        const updatedBill = await tx.bill.findUnique({
          where: { id: amendment.billId },
          include: {
            items: true,
            vendor: true,
          },
        })

        return {
          amendment: updatedAmendment,
          bill: updatedBill,
          adjustmentJournal,
        }
      })

      // Record audit
      await recordAudit({
        entity: "billAmendment",
        entityId: input.id,
        action: "approve",
        before: amendment,
        after: result.amendment,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          billId: amendment.billId,
          financialImpact,
          adjustmentJournalId: result.adjustmentJournal?.transactionIds?.[0],
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, amendmentId: input.id })
      })

      return result
    }),

  /**
   * Reject a bill amendment
   * 
   * No changes applied, unlocks bill
   */
  reject: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_EDIT))
    .input(z.object({
      id: z.string().min(1, "Amendment ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      rejectionReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get amendment
      const amendment = await prisma.billAmendment.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          bill: true,
        },
      })

      if (!amendment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Amendment not found",
        })
      }

      if (amendment.status !== AmendmentStatus.PENDING) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Amendment is already ${amendment.status.toLowerCase()}`,
        })
      }

      // Update amendment status
      const updatedAmendment = await prisma.billAmendment.update({
        where: { id: input.id },
        data: {
          status: AmendmentStatus.REJECTED,
          approvedBy: ctx.session.user.id,
          approvedAt: new Date(),
          reason: input.rejectionReason 
            ? `${amendment.reason}\n\nRejection reason: ${input.rejectionReason}`
            : amendment.reason,
        },
        include: {
          bill: {
            include: {
              vendor: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Unlock bill
      await unlockBill(amendment.billId, ctx.organizationId)

      // Record audit
      await recordAudit({
        entity: "billAmendment",
        entityId: input.id,
        action: "reject",
        before: amendment,
        after: updatedAmendment,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          billId: amendment.billId,
          rejectionReason: input.rejectionReason,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, amendmentId: input.id })
      })

      return updatedAmendment
    }),
})




