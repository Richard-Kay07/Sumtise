import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { Prisma, PurchaseOrderStatus } from "@prisma/client"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLineTotals(lines: Array<{ quantity: number; unitPrice: number; taxRate: number }>) {
  let subtotal = new Prisma.Decimal(0)
  let taxAmount = new Prisma.Decimal(0)
  for (const l of lines) {
    const sub = new Prisma.Decimal(l.quantity).times(l.unitPrice)
    const tax = sub.times(new Prisma.Decimal(l.taxRate).div(100))
    subtotal = subtotal.plus(sub)
    taxAmount = taxAmount.plus(tax)
  }
  return { subtotal, taxAmount, total: subtotal.plus(taxAmount) }
}

async function nextPoNumber(orgId: string): Promise<string> {
  const last = await prisma.purchaseOrder.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: { poNumber: true },
  })
  if (!last) return "PO-0001"
  const n = parseInt(last.poNumber.replace(/\D/g, ""), 10) || 0
  return `PO-${String(n + 1).padStart(4, "0")}`
}

async function deriveStatus(poId: string): Promise<PurchaseOrderStatus> {
  const lines = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: poId } })
  if (lines.length === 0) return PurchaseOrderStatus.APPROVED
  const allFull = lines.every((l) => new Prisma.Decimal(l.receivedQty).greaterThanOrEqualTo(l.quantity))
  const anyPartial = lines.some((l) => new Prisma.Decimal(l.receivedQty).greaterThan(0))
  if (allFull) return PurchaseOrderStatus.FULLY_RECEIVED
  if (anyPartial) return PurchaseOrderStatus.PARTIALLY_RECEIVED
  return PurchaseOrderStatus.APPROVED
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  accountId:   z.string().optional(),
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unitPrice:   z.number().min(0),
  taxRate:     z.number().min(0).max(100).default(0),
})

const createPoSchema = z.object({
  organizationId:  z.string().min(1),
  vendorId:        z.string().min(1),
  date:            z.union([z.date(), z.string()]),
  expectedDelivery: z.union([z.date(), z.string()]).optional(),
  currency:        z.string().default("GBP"),
  notes:           z.string().optional(),
  tags:            z.array(z.string()).default([]),
  lines:           z.array(lineSchema).min(1, "At least one line is required"),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export const purchaseOrdersRouter = createTRPCRouter({

  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      status: z.nativeEnum(PurchaseOrderStatus).optional(),
      vendorId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
      page:  z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, status, vendorId, dateFrom, dateTo } = input
      const where: Prisma.PurchaseOrderWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
        ...(status   && { status }),
        ...(vendorId && { vendorId }),
        ...(dateFrom || dateTo ? {
          date: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo   && { lte: new Date(dateTo) }),
          },
        } : {}),
      }
      const [pos, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            vendor: { select: { id: true, name: true, alias: true } },
            lines: { select: { id: true, quantity: true, receivedQty: true, invoicedQty: true, total: true } },
            _count: { select: { bills: true } },
          },
        }),
        prisma.purchaseOrder.count({ where }),
      ])
      return { purchaseOrders: pos, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_VIEW))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: input.id },
        include: {
          vendor: true,
          lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } },
          bills: {
            where: { deletedAt: null },
            select: { id: true, billNumber: true, date: true, total: true, status: true },
          },
          approvalRequest: { include: { actions: { orderBy: { createdAt: "asc" } } } },
        },
      })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      return po
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_CREATE))
    .input(createPoSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, lines, ...data } = input

      const vendor = await prisma.vendor.findUnique({
        where: { id: data.vendorId, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND", message: "Vendor not found" })

      // Validate expense accounts
      const accountIds = lines.map((l) => l.accountId).filter(Boolean) as string[]
      if (accountIds.length > 0) {
        const accounts = await prisma.chartOfAccount.findMany({
          where: { id: { in: [...new Set(accountIds)] }, organizationId: ctx.organizationId, isActive: true },
        })
        if (accounts.length !== new Set(accountIds).size) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "One or more account IDs are invalid or inactive" })
        }
      }

      const totals = calcLineTotals(lines)
      const poNumber = await nextPoNumber(ctx.organizationId)

      const po = await prisma.purchaseOrder.create({
        data: {
          organizationId: ctx.organizationId,
          poNumber,
          vendorId: data.vendorId,
          date: new Date(data.date),
          expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : null,
          currency: data.currency ?? vendor.currency ?? "GBP",
          notes: data.notes,
          tags: data.tags ?? [],
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          lines: {
            create: lines.map((l) => {
              const sub = new Prisma.Decimal(l.quantity).times(l.unitPrice)
              const tax = sub.times(new Prisma.Decimal(l.taxRate).div(100))
              return {
                accountId:   l.accountId,
                description: l.description,
                quantity:    new Prisma.Decimal(l.quantity),
                unitPrice:   new Prisma.Decimal(l.unitPrice),
                taxRate:     new Prisma.Decimal(l.taxRate),
                subtotal:    sub,
                taxAmount:   tax,
                total:       sub.plus(tax),
              }
            }),
          },
        },
        include: { vendor: true, lines: true },
      })

      await recordAudit({
        entity: "purchaseOrder", entityId: po.id, action: "create", after: po,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        meta: { correlationId: ctx.correlationId, poNumber: po.poNumber },
      }).catch(() => {})

      return po
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_EDIT))
    .input(z.object({
      id:             z.string().min(1),
      organizationId: z.string().min(1),
      data: z.object({
        vendorId:         z.string().optional(),
        date:             z.union([z.date(), z.string()]).optional(),
        expectedDelivery: z.union([z.date(), z.string()]).optional().nullable(),
        currency:         z.string().optional(),
        notes:            z.string().optional(),
        tags:             z.array(z.string()).optional(),
        lines:            z.array(lineSchema).min(1).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const before = await prisma.purchaseOrder.findUnique({ where: { id: input.id }, include: { lines: true } })
      if (!before || before.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (![PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.REJECTED].includes(before.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Cannot edit a PO with status ${before.status}` })
      }

      const updateData: Prisma.PurchaseOrderUpdateInput = {}
      if (input.data.date) updateData.date = new Date(input.data.date as string)
      if (input.data.expectedDelivery !== undefined) {
        updateData.expectedDelivery = input.data.expectedDelivery ? new Date(input.data.expectedDelivery as string) : null
      }
      if (input.data.currency)  updateData.currency = input.data.currency
      if (input.data.notes !== undefined) updateData.notes = input.data.notes
      if (input.data.tags)      updateData.tags = input.data.tags

      if (input.data.lines) {
        const totals = calcLineTotals(input.data.lines)
        updateData.subtotal  = totals.subtotal
        updateData.taxAmount = totals.taxAmount
        updateData.total     = totals.total
        await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: input.id } })
        updateData.lines = {
          create: input.data.lines.map((l) => {
            const sub = new Prisma.Decimal(l.quantity).times(l.unitPrice)
            const tax = sub.times(new Prisma.Decimal(l.taxRate).div(100))
            return {
              accountId: l.accountId, description: l.description,
              quantity: new Prisma.Decimal(l.quantity), unitPrice: new Prisma.Decimal(l.unitPrice),
              taxRate: new Prisma.Decimal(l.taxRate), subtotal: sub, taxAmount: tax, total: sub.plus(tax),
            }
          }),
        }
      }

      const after = await prisma.purchaseOrder.update({
        where: { id: input.id }, data: updateData,
        include: { vendor: true, lines: true },
      })

      await recordAudit({
        entity: "purchaseOrder", entityId: input.id, action: "update", before, after,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        meta: { correlationId: ctx.correlationId },
      }).catch(() => {})

      return after
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_DELETE))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({ where: { id: input.id } })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (po.status !== PurchaseOrderStatus.DRAFT) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only DRAFT purchase orders can be deleted" })
      }
      const deleted = await prisma.purchaseOrder.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
      await recordAudit({
        entity: "purchaseOrder", entityId: input.id, action: "delete", before: po, after: deleted,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        meta: { correlationId: ctx.correlationId },
      }).catch(() => {})
      return deleted
    }),

  submit: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_CREATE))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({ where: { id: input.id } })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (po.status !== PurchaseOrderStatus.DRAFT) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only DRAFT purchase orders can be submitted" })
      }

      // Check workflow policy
      const policy = await prisma.workflowPolicy.findUnique({
        where: { organizationId_entityType: { organizationId: ctx.organizationId, entityType: "PURCHASE_ORDER" } },
      })

      const needsApproval =
        policy?.isActive &&
        policy.approverUserId &&
        (!policy.amountThreshold || new Prisma.Decimal(po.total).greaterThanOrEqualTo(policy.amountThreshold))

      if (needsApproval) {
        const deadline = policy.deadlineHours
          ? new Date(Date.now() + policy.deadlineHours * 3_600_000)
          : null

        await prisma.$transaction([
          prisma.purchaseOrder.update({
            where: { id: input.id },
            data: { status: PurchaseOrderStatus.SUBMITTED, submittedAt: new Date() },
          }),
          prisma.approvalRequest.create({
            data: {
              organizationId: ctx.organizationId,
              entityType: "PURCHASE_ORDER",
              purchaseOrderId: input.id,
              submittedBy: ctx.session.user.id,
              assignedTo: policy.approverUserId,
              deadline,
            },
          }),
        ])
      } else {
        // Auto-approve when no active policy
        await prisma.purchaseOrder.update({
          where: { id: input.id },
          data: {
            status: PurchaseOrderStatus.APPROVED,
            submittedAt: new Date(),
            approvedAt: new Date(),
            approvedBy: ctx.session.user.id,
          },
        })
      }

      return prisma.purchaseOrder.findUnique({
        where: { id: input.id },
        include: { vendor: true, lines: true, approvalRequest: true },
      })
    }),

  approve: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_APPROVE))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: input.id }, include: { approvalRequest: true },
      })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (![PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.DRAFT].includes(po.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Cannot approve a PO with status ${po.status}` })
      }

      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: input.id },
          data: {
            status: PurchaseOrderStatus.APPROVED,
            approvedAt: new Date(),
            approvedBy: ctx.session.user.id,
          },
        })
        if (po.approvalRequest) {
          await tx.approvalRequest.update({
            where: { id: po.approvalRequest.id },
            data: { status: "APPROVED", completedAt: new Date(), completedBy: ctx.session.user.id, notes: input.notes },
          })
          await tx.approvalAction.create({
            data: {
              approvalRequestId: po.approvalRequest.id,
              actionType: "APPROVED",
              actorId: ctx.session.user.id,
              notes: input.notes,
            },
          })
        }
      })

      await recordAudit({
        entity: "purchaseOrder", entityId: input.id, action: "approve", before: po,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        meta: { correlationId: ctx.correlationId },
      }).catch(() => {})

      return prisma.purchaseOrder.findUnique({ where: { id: input.id }, include: { vendor: true, lines: true } })
    }),

  reject: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_APPROVE))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: input.id }, include: { approvalRequest: true },
      })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (po.status !== PurchaseOrderStatus.SUBMITTED) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only SUBMITTED purchase orders can be rejected" })
      }

      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({ where: { id: input.id }, data: { status: PurchaseOrderStatus.REJECTED } })
        if (po.approvalRequest) {
          await tx.approvalRequest.update({
            where: { id: po.approvalRequest.id },
            data: { status: "REJECTED", completedAt: new Date(), completedBy: ctx.session.user.id, notes: input.reason },
          })
          await tx.approvalAction.create({
            data: {
              approvalRequestId: po.approvalRequest.id,
              actionType: "REJECTED",
              actorId: ctx.session.user.id,
              notes: input.reason,
            },
          })
        }
      })

      return prisma.purchaseOrder.findUnique({ where: { id: input.id }, include: { vendor: true, lines: true } })
    }),

  receive: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_EDIT))
    .input(z.object({
      id:             z.string().min(1),
      organizationId: z.string().min(1),
      receipts: z.array(z.object({
        lineId: z.string().min(1),
        qty:    z.number().positive(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({ where: { id: input.id }, include: { lines: true } })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (![PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED].includes(po.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PO must be APPROVED or PARTIALLY_RECEIVED to receive goods" })
      }

      await prisma.$transaction(async (tx) => {
        for (const receipt of input.receipts) {
          const line = po.lines.find((l) => l.id === receipt.lineId)
          if (!line) throw new TRPCError({ code: "NOT_FOUND", message: `Line ${receipt.lineId} not found on this PO` })
          const newQty = new Prisma.Decimal(line.receivedQty).plus(receipt.qty)
          if (newQty.greaterThan(line.quantity)) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Receipt qty exceeds ordered qty for "${line.description}"` })
          }
          await tx.purchaseOrderLine.update({ where: { id: receipt.lineId }, data: { receivedQty: newQty } })
        }
      })

      const newStatus = await deriveStatus(input.id)
      const updated = await prisma.purchaseOrder.update({ where: { id: input.id }, data: { status: newStatus }, include: { vendor: true, lines: true } })

      await recordAudit({
        entity: "purchaseOrder", entityId: input.id, action: "receive", before: po, after: updated,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        meta: { correlationId: ctx.correlationId, receipts: input.receipts },
      }).catch(() => {})

      return updated
    }),

  close: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_APPROVE))
    .input(z.object({ id: z.string().min(1), organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)
      const po = await prisma.purchaseOrder.findUnique({ where: { id: input.id } })
      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      const closeable = [
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.FULLY_RECEIVED,
      ]
      if (!closeable.includes(po.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Cannot close a PO with status ${po.status}` })
      }
      return prisma.purchaseOrder.update({
        where: { id: input.id },
        data: { status: PurchaseOrderStatus.CLOSED, closedAt: new Date() },
        include: { vendor: true, lines: true },
      })
    }),

  matchBill: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_EDIT))
    .input(z.object({
      id:             z.string().min(1),
      organizationId: z.string().min(1),
      billId:         z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("purchaseOrder", input.id, ctx.organizationId)

      const [po, bill] = await Promise.all([
        prisma.purchaseOrder.findUnique({ where: { id: input.id }, include: { lines: true } }),
        prisma.bill.findUnique({ where: { id: input.billId } }),
      ])

      if (!po || po.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" })
      if (!bill || bill.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" })
      if (bill.organizationId !== ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
      if (bill.vendorId !== po.vendorId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bill vendor does not match PO vendor" })
      }
      if (bill.purchaseOrderId && bill.purchaseOrderId !== input.id) {
        throw new TRPCError({ code: "CONFLICT", message: "Bill is already matched to a different PO" })
      }

      // Update bill's PO link and increment invoicedQty on lines (pro-rata by line total)
      const billTotal = new Prisma.Decimal(bill.total)
      const poTotal   = new Prisma.Decimal(po.total)

      await prisma.$transaction(async (tx) => {
        await tx.bill.update({ where: { id: input.billId }, data: { purchaseOrderId: input.id } })

        if (poTotal.greaterThan(0)) {
          for (const line of po.lines) {
            const lineFraction = new Prisma.Decimal(line.total).div(poTotal)
            const invoicedInc  = billTotal.times(lineFraction)
            await tx.purchaseOrderLine.update({
              where: { id: line.id },
              data: { invoicedQty: new Prisma.Decimal(line.invoicedQty).plus(invoicedInc) },
            })
          }
        }
      })

      await recordAudit({
        entity: "purchaseOrder", entityId: input.id, action: "matchBill",
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        meta: { correlationId: ctx.correlationId, billId: input.billId },
      }).catch(() => {})

      return prisma.purchaseOrder.findUnique({ where: { id: input.id }, include: { vendor: true, lines: true, bills: true } })
    }),

  committedSpend: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PURCHASE_ORDERS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      periodStart:    z.string().optional(),
      periodEnd:      z.string().optional(),
      accountId:      z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const start = input.periodStart ? new Date(input.periodStart) : new Date(new Date().getFullYear(), 3, 1) // UK tax year Apr 1
      const end   = input.periodEnd   ? new Date(input.periodEnd)   : new Date()

      // Budget for period (by account)
      const budgets = await prisma.budget.findMany({
        where: { organizationId: ctx.organizationId },
        include: {
          lines: {
            where: {
              ...(input.accountId && { accountId: input.accountId }),
              account: { type: { in: ["EXPENSE"] } },
            },
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      })

      // PO committed spend (APPROVED / PARTIALLY_RECEIVED / FULLY_RECEIVED)
      const committedPos = await prisma.purchaseOrder.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          status: { in: [
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
            PurchaseOrderStatus.FULLY_RECEIVED,
          ]},
          date: { gte: start, lte: end },
        },
        include: {
          lines: {
            where: input.accountId ? { accountId: input.accountId } : {},
          },
        },
      })

      // Invoiced (bills matched to POs in period)
      const matchedBills = await prisma.bill.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          purchaseOrderId: { not: null },
          date: { gte: start, lte: end },
        },
        select: { purchaseOrderId: true, total: true, status: true },
      })

      // Aggregate
      const budgetByAccount = new Map<string, { account: any; budgeted: number }>()
      for (const budget of budgets) {
        for (const line of budget.lines) {
          const key = line.accountId
          const existing = budgetByAccount.get(key)
          budgetByAccount.set(key, {
            account: line.account,
            budgeted: (existing?.budgeted ?? 0) + Number(line.amount),
          })
        }
      }

      const committedByAccount = new Map<string, number>()
      const invoicedByPo = new Map<string, number>()
      for (const bill of matchedBills) {
        if (bill.purchaseOrderId) {
          const curr = invoicedByPo.get(bill.purchaseOrderId) ?? 0
          invoicedByPo.set(bill.purchaseOrderId, curr + Number(bill.total))
        }
      }

      let totalCommitted = 0
      let totalInvoiced  = 0
      for (const po of committedPos) {
        for (const line of po.lines) {
          const key = line.accountId ?? "__unassigned__"
          committedByAccount.set(key, (committedByAccount.get(key) ?? 0) + Number(line.total))
        }
        totalCommitted += Number(po.total)
        totalInvoiced  += invoicedByPo.get(po.id) ?? 0
      }

      const summary = Array.from(budgetByAccount.entries()).map(([accountId, { account, budgeted }]) => {
        const committed = committedByAccount.get(accountId) ?? 0
        const invoiced  = 0 // line-level invoiced requires PO→line→bill join, omit for now
        return {
          account,
          budgeted,
          committed,
          invoiced,
          remaining: budgeted - committed,
          utilisation: budgeted > 0 ? Math.round((committed / budgeted) * 1000) / 10 : null,
        }
      })

      return {
        periodStart: start.toISOString().split("T")[0],
        periodEnd:   end.toISOString().split("T")[0],
        totals: { totalCommitted, totalInvoiced, outstanding: totalCommitted - totalInvoiced },
        byAccount: summary,
      }
    }),
})
