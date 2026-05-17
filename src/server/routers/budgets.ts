import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

const budgetTypeEnum   = z.enum(["ANNUAL", "QUARTERLY", "MONTHLY", "PROJECT", "GRANT"])
const budgetStatusEnum = z.enum(["DRAFT", "APPROVED", "ACTIVE", "CLOSED", "ARCHIVED"])

// Full account fields shared across queries — includes COA metadata for budget UI
const ACCOUNT_SELECT = {
  id:              true,
  code:            true,
  name:            true,
  type:            true,
  subType:         true,
  normalBalance:   true,
  description:     true,
  isControlAccount: true,
  isActive:        true,
} as const

export const budgetsRouter = createTRPCRouter({

  // ── List ──────────────────────────────────────────────────────────────────
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

  // ── Get by ID ─────────────────────────────────────────────────────────────
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const budget = await prisma.budget.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId },
        include: {
          lines: {
            include: { account: { select: ACCOUNT_SELECT } },
            orderBy: [{ account: { type: "asc" } }, { account: { code: "asc" } }],
          },
          project: { select: { id: true, name: true } },
        },
      })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })
      return budget
    }),

  // ── Accounts available for budgeting (COA-aware) ──────────────────────────
  getAvailableAccounts: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      types:          z.array(z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"])).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.chartOfAccount.findMany({
        where: {
          organizationId:  ctx.organizationId,
          isActive:        true,
          isControlAccount: false,
          ...(input.types?.length ? { type: { in: input.types } } : {}),
        },
        select:  ACCOUNT_SELECT,
        orderBy: [{ type: "asc" }, { code: "asc" }],
      })
    }),

  // ── Create ────────────────────────────────────────────────────────────────
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      name:           z.string().min(1),
      description:    z.string().optional(),
      budgetType:     budgetTypeEnum,
      periodStart:    z.union([z.date(), z.string()]),
      periodEnd:      z.union([z.date(), z.string()]),
      currency:       z.string().default("GBP"),
      projectId:      z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const start = new Date(input.periodStart)
      const end   = new Date(input.periodEnd)
      if (end <= start) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Period end must be after period start." })
      }
      return prisma.budget.create({
        data: {
          organizationId: ctx.organizationId,
          name:           input.name,
          description:    input.description,
          budgetType:     input.budgetType,
          periodStart:    start,
          periodEnd:      end,
          currency:       input.currency,
          projectId:      input.projectId || undefined,
          notes:          input.notes,
          status:         "DRAFT",
        },
      })
    }),

  // ── Update ────────────────────────────────────────────────────────────────
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      id:             z.string(),
      name:           z.string().optional(),
      description:    z.string().optional(),
      status:         budgetStatusEnum.optional(),
      notes:          z.string().optional(),
      approvedAt:     z.union([z.date(), z.string()]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, approvedAt, ...data } = input
      const budget = await prisma.budget.findFirst({ where: { id, organizationId: ctx.organizationId } })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })

      const update: any = { ...data }
      if (data.status === "APPROVED") {
        update.approvedAt = approvedAt ? new Date(approvedAt) : new Date()
        update.approvedBy = ctx.userId
      }

      return prisma.budget.update({ where: { id }, data: update })
    }),

  // ── Delete ────────────────────────────────────────────────────────────────
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
      periodStart:    z.union([z.date(), z.string()]),
      periodEnd:      z.union([z.date(), z.string()]),
      budgetedAmount: z.string(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const budget = await prisma.budget.findFirst({ where: { id: input.budgetId, organizationId: ctx.organizationId } })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })

      // COA guard: active accounts only, no control accounts
      const account = await prisma.chartOfAccount.findFirst({
        where: { id: input.accountId, organizationId: ctx.organizationId, isActive: true },
      })
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found or is inactive." })
      if (account.isControlAccount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${account.code} — ${account.name} is a control account. Budget at the sub-account level instead.`,
        })
      }

      return prisma.budgetLine.create({
        data: {
          organizationId: ctx.organizationId,
          budgetId:       input.budgetId,
          accountId:      input.accountId,
          description:    input.description,
          periodStart:    new Date(input.periodStart),
          periodEnd:      new Date(input.periodEnd),
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
      if (budgetedAmount !== undefined) update.budgetedAmount = new Prisma.Decimal(budgetedAmount)
      if (actualAmount !== undefined) {
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
            include: { account: { select: ACCOUNT_SELECT } },
            orderBy: [{ account: { type: "asc" } }, { account: { code: "asc" } }],
          },
        },
      })
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" })

      const ZERO = new Prisma.Decimal(0)
      const lines = budget.lines.map((l) => {
        // Variance direction depends on normalBalance:
        // EXPENSE / DR accounts: favourable = actual < budgeted (spent less)
        // REVENUE / CR accounts: favourable = actual > budgeted (earned more)
        const isRevenueType   = l.account.type === "REVENUE" || l.account.normalBalance === "CR"
        const rawVariance     = l.budgetedAmount.minus(l.actualAmount)
        const variance        = isRevenueType ? rawVariance.negated() : rawVariance
        const isFavourable    = variance.greaterThanOrEqualTo(0)
        const variancePercent = l.budgetedAmount.greaterThan(0)
          ? variance.div(l.budgetedAmount).mul(100)
          : null

        return {
          ...l,
          variance,
          variancePercent,
          isFavourable,
          isOverBudget: !isFavourable,
          isRevenueType,
        }
      })

      const totalBudgeted = lines.reduce((s, l) => s.plus(l.budgetedAmount), ZERO)
      const totalActual   = lines.reduce((s, l) => s.plus(l.actualAmount),   ZERO)

      return {
        budget: { id: budget.id, name: budget.name, status: budget.status, budgetType: budget.budgetType },
        lines,
        summary: {
          totalBudgeted,
          totalActual,
          totalVariance:   totalBudgeted.minus(totalActual),
          overBudgetLines: lines.filter((l) => l.isOverBudget).length,
          favourableLines: lines.filter((l) => l.isFavourable).length,
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
      newPeriodStart: z.union([z.date(), z.string()]),
      newPeriodEnd:   z.union([z.date(), z.string()]),
    }))
    .mutation(async ({ ctx, input }) => {
      const source = await prisma.budget.findFirst({
        where:   { id: input.sourceBudgetId, organizationId: ctx.organizationId },
        include: { lines: true },
      })
      if (!source) throw new TRPCError({ code: "NOT_FOUND" })

      const start = new Date(input.newPeriodStart)
      const end   = new Date(input.newPeriodEnd)

      const newBudget = await prisma.budget.create({
        data: {
          organizationId: ctx.organizationId,
          name:           input.newName,
          budgetType:     source.budgetType,
          periodStart:    start,
          periodEnd:      end,
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
            periodStart:    start,
            periodEnd:      end,
            budgetedAmount: l.budgetedAmount,
          })),
        })
      }

      return newBudget
    }),
})
