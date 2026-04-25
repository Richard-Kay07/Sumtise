import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

const grantTypeEnum      = z.enum(["RESTRICTED", "UNRESTRICTED", "CAPITAL", "REVENUE"])
const grantStatusEnum    = z.enum(["PENDING", "ACTIVE", "REPORTING", "CLOSED", "CANCELLED"])
const milestoneStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "WAIVED"])

export const grantsRouter = createTRPCRouter({
  // ── CRUD ──────────────────────────────────────────────────────────────────

  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      status:         grantStatusEnum.optional(),
      grantType:      grantTypeEnum.optional(),
      search:         z.string().optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { status, grantType, search, page, limit } = input
      const skip  = (page - 1) * limit
      const where: any = { organizationId: ctx.organizationId, deletedAt: null }
      if (status)    where.status    = status
      if (grantType) where.grantType = grantType
      if (search)    where.OR = [
        { name:        { contains: search, mode: "insensitive" } },
        { grantNumber: { contains: search, mode: "insensitive" } },
        { funder:      { contains: search, mode: "insensitive" } },
      ]

      const [grants, total] = await Promise.all([
        prisma.grant.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { startDate: "desc" },
          include: {
            _count: { select: { milestones: true } },
          },
        }),
        prisma.grant.count({ where }),
      ])

      return {
        grants,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const grant = await prisma.grant.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        include: {
          milestones: { orderBy: { dueDate: "asc" } },
          account:    { select: { id: true, code: true, name: true } },
        },
      })
      if (!grant) throw new TRPCError({ code: "NOT_FOUND" })
      return grant
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId:  z.string(),
      grantNumber:     z.string(),
      name:            z.string().min(1),
      description:     z.string().optional(),
      funder:          z.string().min(1),
      funderReference: z.string().optional(),
      grantType:       grantTypeEnum,
      totalAmount:     z.string(),
      currency:        z.string().default("GBP"),
      startDate:       z.date(),
      endDate:         z.date().optional(),
      conditions:      z.string().optional(),
      accountId:       z.string().optional(),
      tags:            z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.grant.create({
        data: {
          organizationId:  ctx.organizationId,
          grantNumber:     input.grantNumber,
          name:            input.name,
          description:     input.description,
          funder:          input.funder,
          funderReference: input.funderReference,
          grantType:       input.grantType,
          totalAmount:     new Prisma.Decimal(input.totalAmount),
          currency:        input.currency,
          startDate:       input.startDate,
          endDate:         input.endDate,
          conditions:      input.conditions,
          accountId:       input.accountId,
          tags:            input.tags ?? [],
          status:          "PENDING",
        },
      })
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId:  z.string(),
      id:              z.string(),
      name:            z.string().optional(),
      description:     z.string().optional(),
      funder:          z.string().optional(),
      funderReference: z.string().optional(),
      totalAmount:     z.string().optional(),
      receivedAmount:  z.string().optional(),
      spentAmount:     z.string().optional(),
      status:          grantStatusEnum.optional(),
      endDate:         z.date().optional(),
      conditions:      z.string().optional(),
      accountId:       z.string().optional(),
      tags:            z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, totalAmount, receivedAmount, spentAmount, ...rest } = input
      const grant = await prisma.grant.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } })
      if (!grant) throw new TRPCError({ code: "NOT_FOUND" })

      return prisma.grant.update({
        where: { id },
        data:  {
          ...rest,
          ...(totalAmount    ? { totalAmount:    new Prisma.Decimal(totalAmount) }    : {}),
          ...(receivedAmount ? { receivedAmount: new Prisma.Decimal(receivedAmount) } : {}),
          ...(spentAmount    ? { spentAmount:    new Prisma.Decimal(spentAmount) }    : {}),
        },
      })
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_DELETE))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const grant = await prisma.grant.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null } })
      if (!grant) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.grant.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),

  // ── Milestones ─────────────────────────────────────────────────────────────

  addMilestone: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      grantId:        z.string(),
      name:           z.string().min(1),
      description:    z.string().optional(),
      dueDate:        z.date(),
      amount:         z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const grant = await prisma.grant.findFirst({ where: { id: input.grantId, organizationId: ctx.organizationId } })
      if (!grant) throw new TRPCError({ code: "NOT_FOUND" })

      return prisma.grantMilestone.create({
        data: {
          organizationId: ctx.organizationId,
          grantId:        input.grantId,
          name:           input.name,
          description:    input.description,
          dueDate:        input.dueDate,
          amount:         input.amount ? new Prisma.Decimal(input.amount) : undefined,
          notes:          input.notes,
        },
      })
    }),

  updateMilestone: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      milestoneId:    z.string(),
      name:           z.string().optional(),
      description:    z.string().optional(),
      dueDate:        z.date().optional(),
      amount:         z.string().optional(),
      status:         milestoneStatusEnum.optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { milestoneId, organizationId: _, amount, ...rest } = input
      const ms = await prisma.grantMilestone.findFirst({ where: { id: milestoneId, organizationId: ctx.organizationId } })
      if (!ms) throw new TRPCError({ code: "NOT_FOUND" })

      const data: any = { ...rest, ...(amount ? { amount: new Prisma.Decimal(amount) } : {}) }
      if (rest.status === "COMPLETED" && !ms.completedAt) {
        data.completedAt = new Date()
      }

      return prisma.grantMilestone.update({ where: { id: milestoneId }, data })
    }),

  deleteMilestone: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_DELETE))
    .input(z.object({ organizationId: z.string(), milestoneId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ms = await prisma.grantMilestone.findFirst({ where: { id: input.milestoneId, organizationId: ctx.organizationId } })
      if (!ms) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.grantMilestone.delete({ where: { id: input.milestoneId } })
    }),

  // ── Spending summary ───────────────────────────────────────────────────────

  getSpendingSummary: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const grant = await prisma.grant.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        include: {
          milestones: { orderBy: { dueDate: "asc" } },
          // Tagged transactions via TransactionTag
          transactionTags: true,
        },
      })
      if (!grant) throw new TRPCError({ code: "NOT_FOUND" })

      const ZERO = new Prisma.Decimal(0)
      const taggedSpend = grant.transactionTags.reduce(
        (s, t) => s.plus(t.allocationAmount ?? 0),
        ZERO
      )

      const milestoneTotal   = grant.milestones.reduce((s, m) => s.plus(m.amount ?? 0), ZERO)
      const completedTotal   = grant.milestones.filter((m) => m.status === "COMPLETED").reduce((s, m) => s.plus(m.amount ?? 0), ZERO)

      return {
        grantId:            grant.id,
        totalAmount:        grant.totalAmount,
        receivedAmount:     grant.receivedAmount,
        spentAmount:        grant.spentAmount,
        taggedTransactions: taggedSpend,
        remainingBudget:    grant.totalAmount.minus(grant.spentAmount),
        utilisationPercent: grant.totalAmount.greaterThan(0)
          ? grant.spentAmount.div(grant.totalAmount).mul(100)
          : ZERO,
        milestones: {
          total:     grant.milestones.length,
          completed: grant.milestones.filter((m) => m.status === "COMPLETED").length,
          overdue:   grant.milestones.filter((m) => m.status === "OVERDUE").length,
          totalValue:     milestoneTotal,
          completedValue: completedTotal,
        },
      }
    }),

  // ── Overdue milestones across all grants ──────────────────────────────────

  getOverdueMilestones: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const now = new Date()
      const milestones = await prisma.grantMilestone.findMany({
        where: {
          organizationId: ctx.organizationId,
          dueDate:        { lt: now },
          status:         { in: ["PENDING", "IN_PROGRESS"] },
        },
        include: { grant: { select: { id: true, name: true, grantNumber: true, funder: true } } },
        orderBy: { dueDate: "asc" },
      })

      // Auto-mark as OVERDUE
      if (milestones.length > 0) {
        await prisma.grantMilestone.updateMany({
          where: { id: { in: milestones.map((m) => m.id) } },
          data:  { status: "OVERDUE" },
        })
      }

      return milestones
    }),
})
