/**
 * Bills Router
 * 
 * CRUD operations for supplier bills with:
 * - Line items with tracking codes
 * - Approval workflow with posting
 * - Payment tracking
 * - Soft-delete
 * - Audit logging
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema, createBillSchema, updateBillSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { postDoubleEntry, type JournalLine } from "@/lib/posting"
import { resolveRate } from "@/lib/finance/fxDb"
import { Prisma, BillStatus } from "@prisma/client"

/**
 * Bill list query schema with filters
 */
const billListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Status filter
  status: z.enum(["DRAFT", "RECEIVED", "APPROVED", "PART_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  // Vendor filter
  vendorId: z.string().optional(),
  // Date range filters
  dateFrom: z.union([z.date(), z.string()]).optional(),
  dateTo: z.union([z.date(), z.string()]).optional(),
  dueFrom: z.union([z.date(), z.string()]).optional(),
  dueTo: z.union([z.date(), z.string()]).optional(),
  // Currency filter
  currency: z.string().optional(),
  // Balance filters
  minBalance: z.number().optional(),
  maxBalance: z.number().optional(),
  // Tags filter
  tags: z.array(z.string()).optional(),
  // Sort
  sortBy: z.enum(["date", "dueDate", "billNumber", "total", "createdAt"]).optional(),
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

export const billsRouter = createTRPCRouter({
  /**
   * Get all bills with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(billListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        status,
        vendorId,
        dateFrom,
        dateTo,
        dueFrom,
        dueTo,
        currency,
        minBalance,
        maxBalance,
        tags,
        sortBy,
        sortOrder,
      } = input

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null, // Soft-delete filter
      }

      // Status filter
      if (status) {
        where.status = status
      }

      // Vendor filter
      if (vendorId) {
        where.vendorId = vendorId
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

      // Due date range filter
      if (dueFrom || dueTo) {
        where.dueDate = {}
        if (dueFrom) {
          const from = typeof dueFrom === "string" ? new Date(dueFrom) : dueFrom
          where.dueDate.gte = from
        }
        if (dueTo) {
          const to = typeof dueTo === "string" ? new Date(dueTo) : dueTo
          to.setHours(23, 59, 59, 999)
          where.dueDate.lte = to
        }
      }

      // Currency filter
      if (currency) {
        where.currency = currency
      }

      // Tags filter
      if (tags && tags.length > 0) {
        where.tags = {
          hasSome: tags,
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
      const [bills, total] = await Promise.all([
        prisma.bill.findMany({
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
            items: {
              select: {
                id: true,
                description: true,
                quantity: true,
                unitPrice: true,
                total: true,
                taxRate: true,
                accountId: true,
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                paymentDate: true,
                status: true,
              },
            },
          },
        }),
        prisma.bill.count({ where }),
      ])

      // Calculate balance for each bill (total - payments)
      const billsWithBalance = bills.map((bill) => {
        const totalPaid = bill.payments
          .filter((p) => p.status === "COMPLETED")
          .reduce((sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())), new Prisma.Decimal(0))

        const balance = new Prisma.Decimal(bill.total.toString()).minus(totalPaid)

        // Apply balance filters if specified
        if (minBalance !== undefined && balance.lessThan(minBalance)) {
          return null
        }
        if (maxBalance !== undefined && balance.greaterThan(maxBalance)) {
          return null
        }

        return {
          ...bill,
          balance: balance.toNumber(),
          totalPaid: totalPaid.toNumber(),
        }
      }).filter((b) => b !== null)

      return {
        bills: billsWithBalance,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get bill by ID with full details
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("bill", input.id, ctx.organizationId)

      const bill = await prisma.bill.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          vendor: true,
          items: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
          payments: {
            orderBy: {
              paymentDate: "desc",
            },
          },
          amendments: {
            orderBy: {
              createdAt: "desc",
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
          },
        },
      })

      if (!bill || bill.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        })
      }

      // Calculate balance
      const totalPaid = bill.payments
        .filter((p) => p.status === "COMPLETED")
        .reduce((sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())), new Prisma.Decimal(0))

      const balance = new Prisma.Decimal(bill.total.toString()).minus(totalPaid)

      return {
        ...bill,
        balance: balance.toNumber(),
        totalPaid: totalPaid.toNumber(),
      }
    }),

  /**
   * Create a new bill
   * 
   * Validates vendor existence, currency defaults, COA account types, and tax calculation
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_CREATE))
    .input(createBillSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, items, ...billData } = input

      // Verify vendor exists and belongs to organization
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: billData.vendorId,
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

      // Check for unique bill number
      const existingBill = await prisma.bill.findFirst({
        where: {
          organizationId: ctx.organizationId,
          billNumber: billData.billNumber,
          deletedAt: null,
        },
      })

      if (existingBill) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A bill with number "${billData.billNumber}" already exists`,
        })
      }

      // Validate all account IDs and ensure they are EXPENSE or COGS type
      const accountIds = items.map((item) => item.accountId).filter(Boolean) as string[]
      const uniqueAccountIds = [...new Set(accountIds)]

      if (uniqueAccountIds.length > 0) {
        const accounts = await prisma.chartOfAccount.findMany({
          where: {
            id: { in: uniqueAccountIds },
            organizationId: ctx.organizationId,
            isActive: true,
          },
        })

        if (accounts.length !== uniqueAccountIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more account IDs are invalid or inactive",
          })
        }

        // Check account types (must be EXPENSE or COGS - COGS is typically EXPENSE type in our schema)
        const invalidAccounts = accounts.filter(
          (acc) => acc.type !== "EXPENSE"
        )

        if (invalidAccounts.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Account(s) must be of type EXPENSE: ${invalidAccounts.map((a) => a.code).join(", ")}`,
          })
        }
      }

      // Calculate totals
      const totals = calculateBillTotals(items)

      // Use vendor currency if not specified
      const currency = billData.currency || vendor.currency || "GBP"

      // Calculate due date if payment terms provided
      let dueDate = billData.dueDate
      if (!dueDate && billData.paymentTerms) {
        dueDate = new Date(billData.date)
        dueDate.setDate(dueDate.getDate() + billData.paymentTerms)
      } else if (!dueDate) {
        // Use vendor default payment terms
        const paymentTerms = vendor.paymentTerms || 30
        dueDate = new Date(billData.date)
        dueDate.setDate(dueDate.getDate() + paymentTerms)
      }

      // Create bill with items
      const bill = await prisma.bill.create({
        data: {
          organizationId: ctx.organizationId,
          vendorId: billData.vendorId,
          billNumber: billData.billNumber,
          date: billData.date,
          dueDate,
          currency,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          notes: billData.notes,
          tags: billData.tags || [],
          attachments: billData.attachments ? JSON.parse(JSON.stringify(billData.attachments)) : null,
          status: BillStatus.DRAFT,
          items: {
            create: items.map((item) => ({
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              total: new Prisma.Decimal(item.quantity * item.unitPrice * (1 + item.taxRate / 100)),
              taxRate: new Prisma.Decimal(item.taxRate),
              taxCodeId: item.taxCodeId,
              accountId: item.accountId,
              lineMemo: item.lineMemo,
              trackingCodes: item.trackingCodes ? JSON.parse(JSON.stringify(item.trackingCodes)) : null,
            })),
          },
        },
        include: {
          vendor: true,
          items: {
            include: {
              account: true,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "bill",
        entityId: bill.id,
        action: "create",
        after: bill,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          billNumber: bill.billNumber,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, billId: bill.id })
      })

      return bill
    }),

  /**
   * Update a bill
   * 
   * Cannot update vendorId, status, totals after approval
   */
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_EDIT))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      data: updateBillSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("bill", input.id, ctx.organizationId)

      // Get before state for audit
      const before = await prisma.bill.findUnique({
        where: { id: input.id },
        include: { items: true },
      })

      if (!before || before.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        })
      }

      // Check if bill is locked for amendment
      const metadata = (before.metadata as any) || {}
      if (metadata.lockedForAmendment && metadata.pendingAmendmentId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bill is locked for amendment ${metadata.pendingAmendmentId}. Please resolve that amendment first.`,
        })
      }

      // Cannot update if approved or paid (must use amendment workflow)
      if (before.status === BillStatus.APPROVED || before.status === BillStatus.PAID || before.status === BillStatus.PART_PAID) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot update bill after approval. Use amendment workflow.",
        })
      }

      // Check for bill number collision if updating
      if (input.data.billNumber && input.data.billNumber !== before.billNumber) {
        const existingBill = await prisma.bill.findFirst({
          where: {
            organizationId: ctx.organizationId,
            billNumber: input.data.billNumber,
            id: { not: input.id },
            deletedAt: null,
          },
        })

        if (existingBill) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A bill with number "${input.data.billNumber}" already exists`,
          })
        }
      }

      // Recalculate totals if items are being updated
      let updateData: any = {}
      if (input.data.items) {
        const totals = calculateBillTotals(input.data.items)

        // Validate accounts
        const accountIds = input.data.items.map((item) => item.accountId).filter(Boolean) as string[]
        const uniqueAccountIds = [...new Set(accountIds)]

        if (uniqueAccountIds.length > 0) {
          const accounts = await prisma.chartOfAccount.findMany({
            where: {
              id: { in: uniqueAccountIds },
              organizationId: ctx.organizationId,
              isActive: true,
              type: "EXPENSE",
            },
          })

          if (accounts.length !== uniqueAccountIds.length) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "One or more account IDs are invalid, inactive, or not EXPENSE type",
            })
          }
        }

        updateData.subtotal = totals.subtotal
        updateData.taxAmount = totals.taxAmount
        updateData.total = totals.total
      }

      // Update bill fields
      if (input.data.billNumber) updateData.billNumber = input.data.billNumber
      if (input.data.date) updateData.date = input.data.date
      if (input.data.dueDate) updateData.dueDate = input.data.dueDate
      if (input.data.currency) updateData.currency = input.data.currency
      if (input.data.notes !== undefined) updateData.notes = input.data.notes
      if (input.data.tags) updateData.tags = input.data.tags
      if (input.data.attachments !== undefined) {
        updateData.attachments = input.data.attachments 
          ? JSON.parse(JSON.stringify(input.data.attachments))
          : null
      }

      // Update items if provided
      if (input.data.items) {
        // Delete existing items and create new ones
        await prisma.billItem.deleteMany({
          where: { billId: input.id },
        })

        updateData.items = {
          create: input.data.items.map((item) => ({
            description: item.description,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            total: new Prisma.Decimal(item.quantity * item.unitPrice * (1 + item.taxRate / 100)),
            taxRate: new Prisma.Decimal(item.taxRate),
            taxCodeId: item.taxCodeId,
            accountId: item.accountId,
            lineMemo: item.lineMemo,
            trackingCodes: item.trackingCodes ? JSON.parse(JSON.stringify(item.trackingCodes)) : null,
          })),
        }
      }

      // Update bill
      const after = await prisma.bill.update({
        where: { id: input.id },
        data: updateData,
        include: {
          vendor: true,
          items: {
            include: {
              account: true,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "bill",
        entityId: input.id,
        action: "update",
        before,
        after,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          changes: input.data,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, billId: input.id })
      })

      return after
    }),

  /**
   * Delete a bill (soft-delete)
   * 
   * Only allowed if status is DRAFT
   */
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_DELETE))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("bill", input.id, ctx.organizationId)

      // Get before state for audit
      const before = await prisma.bill.findUnique({
        where: { id: input.id },
      })

      if (!before || before.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        })
      }

      // Only allow deletion if DRAFT
      if (before.status !== BillStatus.DRAFT) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot delete bill. Only DRAFT bills can be deleted. Use cancel or amendment workflow for approved bills.",
        })
      }

      // Soft delete
      const after = await prisma.bill.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })

      // Record audit
      await recordAudit({
        entity: "bill",
        entityId: input.id,
        action: "delete",
        before,
        after,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, billId: input.id })
      })

      return after
    }),

  /**
   * Get outstanding bills for payment
   * 
   * Returns approved, unpaid bills with balance and remittance info
   */
  getOutstandingForPayment: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      vendorId: z.string().optional(),
      currency: z.string().optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null,
        status: {
          in: [BillStatus.APPROVED, BillStatus.PART_PAID, BillStatus.OVERDUE],
        },
      }

      if (input.vendorId) {
        where.vendorId = input.vendorId
      }

      if (input.currency) {
        where.currency = input.currency
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
              status: "COMPLETED",
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

      // Calculate balance for each bill
      const outstandingBills = bills
        .map((bill) => {
          const totalPaid = bill.payments.reduce(
            (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
            new Prisma.Decimal(0)
          )

          const balance = new Prisma.Decimal(bill.total.toString()).minus(totalPaid)

          // Apply amount filters
          if (input.minAmount !== undefined && balance.lessThan(input.minAmount)) {
            return null
          }
          if (input.maxAmount !== undefined && balance.greaterThan(input.maxAmount)) {
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
    }),

  /**
   * Approve a bill
   * 
   * Locks header/lines and creates posting:
   * - DR expense/COGS lines
   * - CR AP control account
   */
  approve: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_APPROVE))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("bill", input.id, ctx.organizationId)

      // Get bill with items
      const bill = await prisma.bill.findUnique({
        where: { id: input.id },
        include: {
          items: {
            include: {
              account: true,
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

      // Only DRAFT or RECEIVED bills can be approved
      if (bill.status !== BillStatus.DRAFT && bill.status !== BillStatus.RECEIVED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot approve bill with status ${bill.status}`,
        })
      }

      // Check if already posted
      if (bill.postedAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bill has already been posted to the ledger",
        })
      }

      // Get AP control account (Accounts Payable)
      const apAccount = await prisma.chartOfAccount.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: "LIABILITY",
          code: { contains: "2100" }, // Accounts Payable code
          isActive: true,
        },
      })

      if (!apAccount) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Accounts Payable control account not found. Please set up chart of accounts.",
        })
      }

      // Build journal lines for posting
      const journalLines: JournalLine[] = []

      // DR expense/COGS lines
      for (const item of bill.items) {
        if (!item.accountId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Bill item "${item.description}" is missing an account ID`,
          })
        }

        const lineTotal = new Prisma.Decimal(item.total.toString())
        journalLines.push({
          accountId: item.accountId,
          debit: lineTotal.toNumber(),
          credit: 0,
          description: `Bill ${bill.billNumber} - ${item.description}`,
          reference: bill.billNumber,
          metadata: {
            billId: bill.id,
            billItemId: item.id,
            vendorId: bill.vendorId,
          },
        })
      }

      // CR AP control account
      const totalAmount = new Prisma.Decimal(bill.total.toString())
      journalLines.push({
        accountId: apAccount.id,
        debit: 0,
        credit: totalAmount.toNumber(),
        description: `Accounts Payable - Bill ${bill.billNumber} - ${bill.vendor.name}`,
        reference: bill.billNumber,
        metadata: {
          billId: bill.id,
          vendorId: bill.vendorId,
        },
      })

      // Resolve FX rate at bill date (falls back to 1.0 for same-currency orgs)
      const moduleSettings = await prisma.orgModuleSettings.findUnique({
        where: { orgId: ctx.organizationId },
      })
      const functionalCurrency = moduleSettings?.functionalCurrency ?? "GBP"
      const resolvedFx = bill.currency !== functionalCurrency
        ? await resolveRate(ctx.organizationId, bill.currency, functionalCurrency, new Date(bill.date))
        : null
      const bookingRate = resolvedFx?.rate ?? 1.0

      // Post to ledger
      const postingResult = await postDoubleEntry({
        date: bill.date,
        lines: journalLines,
        docRef: `BILL-${bill.billNumber}`,
        currency: bill.currency,
        rate: bookingRate,
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
        description: `Bill ${bill.billNumber} - ${bill.vendor.name}`,
        metadata: {
          billId: bill.id,
          billNumber: bill.billNumber,
          vendorId: bill.vendorId,
        },
      })

      // Update bill status and mark as posted
      const updatedBill = await prisma.bill.update({
        where: { id: input.id },
        data: {
          status: BillStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: ctx.session.user.id,
          postedAt: new Date(),
          metadata: {
            ...(bill.metadata as any || {}),
            postingTransactionIds: postingResult.transactionIds,
            postedAt: new Date().toISOString(),
          },
        },
        include: {
          vendor: true,
          items: {
            include: {
              account: true,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "bill",
        entityId: input.id,
        action: "approve",
        before: bill,
        after: updatedBill,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          postingTransactionIds: postingResult.transactionIds,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, billId: input.id })
      })

      return updatedBill
    }),

  /**
   * Mark bill as paid
   * 
   * Only if not already paid; status transitions PART_PAID→PAID
   * Hooks to payments (assumes payment record exists)
   */
  markAsPaid: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.BILLS_MARK_PAID))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      paymentId: z.string().optional(), // Optional payment ID if payment record exists
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("bill", input.id, ctx.organizationId)

      // Get bill with payments
      const bill = await prisma.bill.findUnique({
        where: { id: input.id },
        include: {
          payments: {
            where: {
              status: "COMPLETED",
            },
          },
        },
      })

      if (!bill || bill.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bill not found",
        })
      }

      // Cannot mark as paid if already fully paid
      if (bill.status === BillStatus.PAID) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bill is already marked as paid",
        })
      }

      // Calculate total paid
      const totalPaid = bill.payments.reduce(
        (sum, p) => sum.plus(new Prisma.Decimal(p.amount.toString())),
        new Prisma.Decimal(0)
      )

      const billTotal = new Prisma.Decimal(bill.total.toString())
      const balance = billTotal.minus(totalPaid)

      // Determine new status
      let newStatus = bill.status
      if (balance.lessThanOrEqualTo(0)) {
        newStatus = BillStatus.PAID
      } else if (totalPaid.greaterThan(0)) {
        newStatus = BillStatus.PART_PAID
      }

      // Update bill status
      const updatedBill = await prisma.bill.update({
        where: { id: input.id },
        data: {
          status: newStatus,
        },
        include: {
          vendor: true,
          items: true,
          payments: true,
        },
      })

      // Record audit
      await recordAudit({
        entity: "bill",
        entityId: input.id,
        action: "markAsPaid",
        before: bill,
        after: updatedBill,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          paymentId: input.paymentId,
          totalPaid: totalPaid.toNumber(),
          balance: balance.toNumber(),
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, billId: input.id })
      })

      return updatedBill
    }),
})

