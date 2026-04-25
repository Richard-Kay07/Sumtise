import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

const budgetTypeEnum   = z.enum(["ANNUAL", "QUARTERLY", "MONTHLY", "PROJECT", "GRANT"])
const budgetStatusEnum = z.enum(["DRAFT", "APPROVED", "ACTIVE", "CLOSED", "ARCHIVED"])

export const budgetsRouter = createTRPCRouter({
  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      status:         budgetStatusEnum.optional(),
      budgetType:     budgetTypeEnum.optional(),
      projectId:      z.string().optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { status, budgetType, projectId, page, limit } = input
      const skip  = (page - 1) * limit
      const where: any = { organizationId: ctx.organizationId }
      if (status)     where.status     = status
      if (budgetType) where.budgetType = budgetType
      if (projectId)  where.projectId  = projectId

      const [budgets, total] = await Promise.all([
        prisma.budget.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { periodStart: "desc" },
          include: {
            project: { select: { id: true, name: true, projectNumber: true } },
            _count:  { select: { lines: true } },
          },
        }),
        prisma.budget.count({ where }),
      ])

      return {
        budgets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const budget = await prisma.budget.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId },
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
            orderBy: { periodStart: "asc" },
          },
          project: { select: { id: true, name: true } },
        },
      })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })
      return budget
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      name:           z.string().min(1),
      description:    z.string().optional(),
      budgetType:     budgetTypeEnum,
      periodStart:    z.date(),
      periodEnd:      z.date(),
      currency:       z.string().default("GBP"),
      projectId:      z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.periodEnd <= input.periodStart) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Period end must be after period start." })
      }
      return prisma.budget.create({
        data: {
          organizationId: ctx.organizationId,
          name:           input.name,
          description:    input.description,
          budgetType:     input.budgetType,
          periodStart:    input.periodStart,
          periodEnd:      input.periodEnd,
          currency:       input.currency,
          projectId:      input.projectId,
          notes:          input.notes,
          status:         "DRAFT",
        },
      })
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      id:             z.string(),
      name:           z.string().optional(),
      description:    z.string().optional(),
      status:         budgetStatusEnum.optional(),
      notes:          z.string().optional(),
      approvedAt:     z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, ...data } = input
      const budget = await prisma.budget.findFirst({ where: { id, organizationId: ctx.organizationId } })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })

      if (data.status === "APPROVED" && !data.approvedAt) {
        (data as any).approvedAt = new Date()
        ;(data as any).approvedBy = ctx.userId
      }

      return prisma.budget.update({ where: { id }, data })
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_DELETE))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const budget = await prisma.budget.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId, status: "DRAFT" },
      })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found or is not in DRAFT status." })
      await prisma.budgetLine.deleteMany({ where: { budgetId: input.id } })
      return prisma.budget.delete({ where: { id: input.id } })
    }),

  // ── Budget lines ──────────────────────────────────────────────────────────

  addLine: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      budgetId:       z.string(),
      accountId:      z.string(),
      description:    z.string().optional(),
      periodStart:    z.date(),
      periodEnd:      z.date(),
      budgetedAmount: z.string(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const budget = await prisma.budget.findFirst({ where: { id: input.budgetId, organizationId: ctx.organizationId } })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })

      const account = await prisma.chartOfAccount.findFirst({ where: { id: input.accountId, organizationId: ctx.organizationId } })
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." })

      return prisma.budgetLine.create({
        data: {
          organizationId: ctx.organizationId,
          budgetId:       input.budgetId,
          accountId:      input.accountId,
          description:    input.description,
          periodStart:    input.periodStart,
          periodEnd:      input.periodEnd,
          budgetedAmount: new Prisma.Decimal(input.budgetedAmount),
        },
      })
    }),

  updateLine: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      lineId:         z.string(),
      budgetedAmount: z.string().optional(),
      actualAmount:   z.string().optional(),
      description:    z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { lineId, organizationId: _, budgetedAmount, actualAmount, ...rest } = input
      const update: any = { ...rest }
      if (budgetedAmount) update.budgetedAmount = new Prisma.Decimal(budgetedAmount)
      if (actualAmount)   {
        update.actualAmount = new Prisma.Decimal(actualAmount)
        const line = await prisma.budgetLine.findFirst({ where: { id: lineId, organizationId: ctx.organizationId } })
        if (line) update.variance = new Prisma.Decimal(actualAmount).minus(line.budgetedAmount)
      }
      return prisma.budgetLine.update({ where: { id: lineId }, data: update })
    }),

  deleteLine: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_DELETE))
    .input(z.object({ organizationId: z.string(), lineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const line = await prisma.budgetLine.findFirst({ where: { id: input.lineId, organizationId: ctx.organizationId } })
      if (!line) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.budgetLine.delete({ where: { id: input.lineId } })
    }),

  // ── Variance report ───────────────────────────────────────────────────────

  getVarianceReport: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), budgetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const budget = await prisma.budget.findFirst({
        where:   { id: input.budgetId, organizationId: ctx.organizationId },
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true, accountType: true } } },
          },
        },
      })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })

      const ZERO = new Prisma.Decimal(0)
      const lines = budget.lines.map((l) => ({
        ...l,
        variance:             l.budgetedAmount.minus(l.actualAmount),
        variancePercent:      l.budgetedAmount.greaterThan(0)
          ? l.actualAmount.minus(l.budgetedAmount).div(l.budgetedAmount).mul(100)
          : null,
        isOverBudget:         l.actualAmount.greaterThan(l.budgetedAmount),
      }))

      const totalBudgeted = lines.reduce((s, l) => s.plus(l.budgetedAmount), ZERO)
      const totalActual   = lines.reduce((s, l) => s.plus(l.actualAmount),   ZERO)

      return {
        budget:       { id: budget.id, name: budget.name, status: budget.status },
        lines,
        summary: {
          totalBudgeted,
          totalActual,
          totalVariance:  totalBudgeted.minus(totalActual),
          overBudgetLines: lines.filter((l) => l.isOverBudget).length,
        },
      }
    }),

  // ── Copy budget ───────────────────────────────────────────────────────────

  copyBudget: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      sourceBudgetId: z.string(),
      newName:        z.string(),
      newPeriodStart: z.date(),
      newPeriodEnd:   z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const source = await prisma.budget.findFirst({
        where:   { id: input.sourceBudgetId, organizationId: ctx.organizationId },
        include: { lines: true },
      })
      if (!source) throw new TRPCError({ code: "NOT_FOUND" })

      const newBudget = await prisma.budget.create({
        data: {
          organizationId: ctx.organizationId,
          name:           input.newName,
          budgetType:     source.budgetType,
          periodStart:    input.newPeriodStart,
          periodEnd:      input.newPeriodEnd,
          currency:       source.currency,
          status:         "DRAFT",
        },
      })

      if (source.lines.length > 0) {
        await prisma.budgetLine.createMany({
          data: source.lines.map((l) => ({
            organizationId: ctx.organizationId,
            budgetId:       newBudget.id,
            accountId:      l.accountId,
            description:    l.description,
            periodStart:    input.newPeriodStart,
            periodEnd:      input.newPeriodEnd,
            budgetedAmount: l.budgetedAmount,
          })),
        })
      }

      return newBudget
    }),
})
