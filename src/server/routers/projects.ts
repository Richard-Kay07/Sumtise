import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

const projectStatusEnum = z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"])
const entryTypeEnum     = z.enum(["LABOUR", "MATERIAL", "EXPENSE", "REVENUE", "OVERHEAD"])

const createProjectSchema = z.object({
  organizationId: z.string(),
  projectNumber:  z.string(),
  name:           z.string().min(1),
  description:    z.string().optional(),
  status:         projectStatusEnum.optional(),
  startDate:      z.date(),
  endDate:        z.date().optional(),
  budget:         z.string().optional(),
  currency:       z.string().default("GBP"),
  customerId:     z.string().optional(),
  managerId:      z.string().optional(),
  tags:           z.array(z.string()).optional(),
})

export const projectsRouter = createTRPCRouter({
  // ── CRUD ──────────────────────────────────────────────────────────────────

  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      status:         projectStatusEnum.optional(),
      customerId:     z.string().optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(100).default(20),
      search:         z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { status, customerId, page, limit, search } = input
      const skip = (page - 1) * limit
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt:      null,
        ...(status     ? { status }     : {}),
        ...(customerId ? { customerId } : {}),
        ...(search ? {
          OR: [
            { name:          { contains: search, mode: "insensitive" } },
            { projectNumber: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      }

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { id: true, name: true } },
            _count:   { select: { entries: true, budgets: true } },
          },
        }),
        prisma.project.count({ where }),
      ])

      return {
        projects,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await prisma.project.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        include: {
          customer: { select: { id: true, name: true } },
          entries:  { orderBy: { date: "desc" }, take: 50 },
          budgets:  { include: { lines: true } },
          _count:   { select: { entries: true } },
        },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND" })
      return project
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      return prisma.project.create({
        data: {
          organizationId: ctx.organizationId,
          projectNumber:  input.projectNumber,
          name:           input.name,
          description:    input.description,
          status:         input.status ?? "ACTIVE",
          startDate:      input.startDate,
          endDate:        input.endDate,
          budget:         input.budget ? new Prisma.Decimal(input.budget) : undefined,
          currency:       input.currency,
          customerId:     input.customerId,
          managerId:      input.managerId,
          tags:           input.tags ?? [],
        },
      })
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(createProjectSchema.partial().extend({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, budget, ...rest } = input
      const project = await prisma.project.findFirst({
        where: { id, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.project.update({
        where: { id },
        data:  { ...rest, ...(budget !== undefined ? { budget: new Prisma.Decimal(budget) } : {}) },
      })
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_DELETE))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await prisma.project.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND" })
      return prisma.project.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
    }),

  // ── Project entries ────────────────────────────────────────────────────────

  addEntry: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      projectId:      z.string(),
      date:           z.date(),
      description:    z.string(),
      entryType:      entryTypeEnum,
      quantity:       z.number().positive().default(1),
      unitCost:       z.number().min(0).default(0),
      amount:         z.number(),
      currency:       z.string().default("GBP"),
      isBillable:     z.boolean().default(false),
      billableAmount: z.number().optional(),
      transactionId:  z.string().optional(),
      invoiceId:      z.string().optional(),
      billId:         z.string().optional(),
      notes:          z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, organizationId: ctx.organizationId, deletedAt: null },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND" })

      return prisma.projectEntry.create({
        data: {
          organizationId: ctx.organizationId,
          projectId:      input.projectId,
          date:           input.date,
          description:    input.description,
          entryType:      input.entryType,
          quantity:       new Prisma.Decimal(input.quantity),
          unitCost:       new Prisma.Decimal(input.unitCost),
          amount:         new Prisma.Decimal(input.amount),
          currency:       input.currency,
          isBillable:     input.isBillable,
          billableAmount: input.billableAmount !== undefined ? new Prisma.Decimal(input.billableAmount) : undefined,
          transactionId:  input.transactionId,
          invoiceId:      input.invoiceId,
          billId:         input.billId,
          notes:          input.notes,
        },
      })
    }),

  listEntries: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      projectId:      z.string(),
      entryType:      entryTypeEnum.optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(200).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit
      const where: any = { organizationId: ctx.organizationId, projectId: input.projectId }
      if (input.entryType) where.entryType = input.entryType

      const [entries, total] = await Promise.all([
        prisma.projectEntry.findMany({ where, skip, take: input.limit, orderBy: { date: "desc" } }),
        prisma.projectEntry.count({ where }),
      ])
      return { entries, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } }
    }),

  // ── Financials summary ────────────────────────────────────────────────────

  getSummary: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await prisma.project.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        include: { entries: true, budgets: { include: { lines: true } } },
      })
      if (!project) throw new TRPCError({ code: "NOT_FOUND" })

      const ZERO = new Prisma.Decimal(0)
      const byType = new Map<string, { cost: Prisma.Decimal; revenue: Prisma.Decimal }>()

      for (const e of project.entries) {
        const row = byType.get(e.entryType) ?? { cost: ZERO, revenue: ZERO }
        if (e.entryType === "REVENUE") {
          row.revenue = row.revenue.plus(e.amount)
        } else {
          row.cost = row.cost.plus(e.amount)
        }
        byType.set(e.entryType, row)
      }

      const totalCost    = project.entries.filter((e) => e.entryType !== "REVENUE").reduce((s, e) => s.plus(e.amount), ZERO)
      const totalRevenue = project.entries.filter((e) => e.entryType === "REVENUE").reduce((s, e) => s.plus(e.amount), ZERO)
      const totalBudget  = project.budget ?? ZERO
      const budgetVariance = totalBudget.minus(totalCost)

      return {
        totalCost,
        totalRevenue,
        margin: totalRevenue.minus(totalCost),
        totalBudget,
        budgetVariance,
        budgetUtilisation: totalBudget.greaterThan(0) ? totalCost.div(totalBudget).mul(100) : null,
        breakdownByType: [...byType.entries()].map(([type, v]) => ({ type, ...v })),
      }
    }),
})
