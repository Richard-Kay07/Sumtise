import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import {
  straightLine,
  decliningBalance,
  sumOfYearsDigits,
  type DepreciationPeriod,
} from "@/lib/finance/depreciation"

const assetCategoryEnum = z.enum([
  "LAND_AND_BUILDINGS", "PLANT_AND_MACHINERY", "VEHICLES",
  "FURNITURE_AND_FIXTURES", "COMPUTER_EQUIPMENT", "INTANGIBLE", "OTHER",
])
const methodEnum = z.enum(["STRAIGHT_LINE", "REDUCING_BALANCE", "UNITS_OF_PRODUCTION", "SUM_OF_YEARS_DIGITS"])
const statusEnum = z.enum(["ACTIVE", "DISPOSED", "FULLY_DEPRECIATED", "UNDER_MAINTENANCE", "WRITTEN_OFF"])

const createAssetSchema = z.object({
  organizationId:       z.string(),
  assetNumber:          z.string(),
  name:                 z.string().min(1),
  description:          z.string().optional(),
  category:             assetCategoryEnum,
  location:             z.string().optional(),
  serialNumber:         z.string().optional(),
  purchaseDate:         z.date(),
  purchasePrice:        z.string(),
  residualValue:        z.string().default("0"),
  usefulLifeYears:      z.string(),
  depreciationMethod:   methodEnum.default("STRAIGHT_LINE"),
  currency:             z.string().default("GBP"),
  assetAccountId:       z.string().optional(),
  depreciationAccountId: z.string().optional(),
  expenseAccountId:     z.string().optional(),
  supplierId:           z.string().optional(),
  warrantyExpiry:       z.date().optional(),
  notes:                z.string().optional(),
})

// ---------------------------------------------------------------------------
// Helper — generate schedule using Phase 3 functions and bulk-insert
// ---------------------------------------------------------------------------

async function buildAndInsertSchedule(
  orgId:    string,
  assetId:  string,
  price:    Prisma.Decimal,
  residual: Prisma.Decimal,
  lifeYears: number,
  method:   string,
  startDate: Date,
  periodsPerYear = 12
) {
  let rows: DepreciationPeriod[]

  if (method === "REDUCING_BALANCE") {
    // Derive the rate that brings the asset to residual over the life
    const rate =
      price.greaterThan(0) && residual.greaterThan(0)
        ? 1 - Math.pow(residual.div(price).toNumber(), 1 / lifeYears)
        : 0.25

    rows = decliningBalance({
      cost:          price.toNumber(),
      residualValue: residual.toNumber(),
      rate,
      periodsPerYear,
      periods:       lifeYears * periodsPerYear,
    })
  } else if (method === "SUM_OF_YEARS_DIGITS") {
    rows = sumOfYearsDigits({
      cost:            price.toNumber(),
      residualValue:   residual.toNumber(),
      usefulLifeYears: lifeYears,
    })
  } else {
    // STRAIGHT_LINE (default) and UNITS_OF_PRODUCTION (fallback to SL)
    rows = straightLine({
      cost:            price.toNumber(),
      residualValue:   residual.toNumber(),
      usefulLifeYears: lifeYears,
      periodsPerYear,
    })
  }

  const data = rows.map((r, i) => {
    const periodStart = new Date(startDate)
    periodStart.setMonth(periodStart.getMonth() + i)
    const periodEnd = new Date(periodStart)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    periodEnd.setDate(0) // last day of month

    return {
      organizationId:          orgId,
      assetId,
      periodStart,
      periodEnd,
      depreciationAmount:      new Prisma.Decimal(r.depreciationCharge),
      accumulatedDepreciation: new Prisma.Decimal(r.accumulatedDepreciation),
      netBookValue:            new Prisma.Decimal(r.closingBookValue),
      status:                  "SCHEDULED" as const,
    }
  })

  await prisma.depreciationSchedule.createMany({ data })
  return data.length
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const fixedAssetsRouter = createTRPCRouter({
  list: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      status:         statusEnum.optional(),
      category:       assetCategoryEnum.optional(),
      search:         z.string().optional(),
      page:           z.number().min(1).default(1),
      limit:          z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { status, category, search, page, limit } = input
      const skip  = (page - 1) * limit
      const where: any = { organizationId: ctx.organizationId }
      if (status)   where.status   = status
      if (category) where.category = category
      if (search)   where.OR = [
        { name:        { contains: search, mode: "insensitive" } },
        { assetNumber: { contains: search, mode: "insensitive" } },
      ]

      const [assets, total] = await Promise.all([
        prisma.fixedAsset.findMany({
          where,
          skip,
          take:    limit,
          orderBy: { purchaseDate: "desc" },
          include: {
            _count: { select: { depreciationSchedules: true } },
          },
        }),
        prisma.fixedAsset.count({ where }),
      ])

      return {
        assets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }
    }),

  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .query(async ({ ctx, input }) => {
      const asset = await prisma.fixedAsset.findFirst({
        where:   { id: input.id, organizationId: ctx.organizationId },
        include: {
          depreciationSchedules: { orderBy: { periodStart: "asc" } },
          assetAccount:           { select: { id: true, code: true, name: true } },
          depreciationAccount:    { select: { id: true, code: true, name: true } },
          depreciationExpenseAccount: { select: { id: true, code: true, name: true } },
          supplier:               { select: { id: true, name: true } },
        },
      })
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" })

      const ZERO = new Prisma.Decimal(0)
      const posted = asset.depreciationSchedules.filter((s) => s.status === "POSTED")
      const accumulatedDepreciation = posted.reduce((s, r) => s.plus(r.depreciationAmount), ZERO)
      const netBookValue = asset.purchasePrice.minus(accumulatedDepreciation)

      return { ...asset, accumulatedDepreciation, netBookValue }
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(createAssetSchema)
    .mutation(async ({ ctx, input }) => {
      const price    = new Prisma.Decimal(input.purchasePrice)
      const residual = new Prisma.Decimal(input.residualValue)
      const life     = parseFloat(input.usefulLifeYears)

      const asset = await prisma.fixedAsset.create({
        data: {
          organizationId:       ctx.organizationId,
          assetNumber:          input.assetNumber,
          name:                 input.name,
          description:          input.description,
          category:             input.category,
          location:             input.location,
          serialNumber:         input.serialNumber,
          purchaseDate:         input.purchaseDate,
          purchasePrice:        price,
          residualValue:        residual,
          usefulLifeYears:      new Prisma.Decimal(life),
          depreciationMethod:   input.depreciationMethod,
          currency:             input.currency,
          assetAccountId:       input.assetAccountId,
          depreciationAccountId: input.depreciationAccountId,
          expenseAccountId:     input.expenseAccountId,
          supplierId:           input.supplierId,
          warrantyExpiry:       input.warrantyExpiry,
          notes:                input.notes,
        },
      })

      const periodsGenerated = await buildAndInsertSchedule(
        ctx.organizationId,
        asset.id,
        price,
        residual,
        life,
        input.depreciationMethod,
        input.purchaseDate
      )

      return { ...asset, periodsGenerated }
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(createAssetSchema.partial().extend({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, organizationId: _, purchasePrice, residualValue, usefulLifeYears, ...rest } = input
      const asset = await prisma.fixedAsset.findFirst({ where: { id, organizationId: ctx.organizationId } })
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" })

      return prisma.fixedAsset.update({
        where: { id },
        data: {
          ...rest,
          ...(purchasePrice    ? { purchasePrice:   new Prisma.Decimal(purchasePrice) }    : {}),
          ...(residualValue    ? { residualValue:   new Prisma.Decimal(residualValue) }    : {}),
          ...(usefulLifeYears  ? { usefulLifeYears: new Prisma.Decimal(usefulLifeYears) }  : {}),
        },
      })
    }),

  dispose: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId:   z.string(),
      id:               z.string(),
      disposalDate:     z.date(),
      disposalProceeds: z.string().optional(),
      disposalReason:   z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const asset = await prisma.fixedAsset.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" })

      // Cancel remaining scheduled entries
      await prisma.depreciationSchedule.updateMany({
        where: { assetId: input.id, status: "SCHEDULED", periodStart: { gte: input.disposalDate } },
        data:  { status: "REVERSED" },
      })

      return prisma.fixedAsset.update({
        where: { id: input.id },
        data: {
          status:          "DISPOSED",
          disposalDate:    input.disposalDate,
          disposalProceeds: input.disposalProceeds ? new Prisma.Decimal(input.disposalProceeds) : undefined,
          disposalReason:  input.disposalReason,
        },
      })
    }),

  // ── Depreciation schedule management ─────────────────────────────────────

  getSchedule: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      assetId:        z.string(),
      status:         z.enum(["SCHEDULED", "POSTED", "REVERSED"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.depreciationSchedule.findMany({
        where: {
          organizationId: ctx.organizationId,
          assetId:        input.assetId,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { periodStart: "asc" },
      })
    }),

  runPeriodDepreciation: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      periodEnd:      z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const unposted = await prisma.depreciationSchedule.findMany({
        where: {
          organizationId: ctx.organizationId,
          status:         "SCHEDULED",
          periodEnd:      { lte: input.periodEnd },
        },
        include: { asset: { select: { name: true, assetNumber: true } } },
      })

      if (unposted.length === 0) return { posted: 0, totalDepreciation: new Prisma.Decimal(0) }

      const now   = new Date()
      const ZERO  = new Prisma.Decimal(0)
      const total = unposted.reduce((s, r) => s.plus(r.depreciationAmount), ZERO)

      await prisma.depreciationSchedule.updateMany({
        where: { id: { in: unposted.map((r) => r.id) } },
        data:  { status: "POSTED", postedAt: now },
      })

      return { posted: unposted.length, totalDepreciation: total }
    }),

  regenerateSchedule: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_EDIT))
    .input(z.object({ organizationId: z.string(), assetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await prisma.fixedAsset.findFirst({
        where: { id: input.assetId, organizationId: ctx.organizationId },
      })
      if (!asset) throw new TRPCError({ code: "NOT_FOUND" })

      // Delete only future unposted entries
      await prisma.depreciationSchedule.deleteMany({
        where: { assetId: input.assetId, status: "SCHEDULED" },
      })

      const periodsGenerated = await buildAndInsertSchedule(
        ctx.organizationId,
        input.assetId,
        asset.purchasePrice,
        asset.residualValue,
        asset.usefulLifeYears.toNumber(),
        asset.depreciationMethod,
        asset.purchaseDate
      )

      return { periodsGenerated }
    }),

  // ── Balance sheet summary ─────────────────────────────────────────────────

  getBalanceSheetSummary: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({ organizationId: z.string(), asAtDate: z.date().optional() }))
    .query(async ({ ctx, input }) => {
      const asAt  = input.asAtDate ?? new Date()
      const ZERO  = new Prisma.Decimal(0)

      const assets = await prisma.fixedAsset.findMany({
        where:   { organizationId: ctx.organizationId, status: { not: "DISPOSED" } },
        include: {
          depreciationSchedules: {
            where:  { status: "POSTED", periodEnd: { lte: asAt } },
            select: { depreciationAmount: true },
          },
        },
      })

      const byCategory = new Map<string, { cost: Prisma.Decimal; accumulated: Prisma.Decimal; count: number }>()

      for (const a of assets) {
        const accumulated = a.depreciationSchedules.reduce((s, r) => s.plus(r.depreciationAmount), ZERO)
        const row = byCategory.get(a.category) ?? { cost: ZERO, accumulated: ZERO, count: 0 }
        row.cost        = row.cost.plus(a.purchasePrice)
        row.accumulated = row.accumulated.plus(accumulated)
        row.count++
        byCategory.set(a.category, row)
      }

      const totalCost = [...byCategory.values()].reduce((s, r) => s.plus(r.cost), ZERO)
      const totalAccumulated = [...byCategory.values()].reduce((s, r) => s.plus(r.accumulated), ZERO)

      return {
        asAtDate:   asAt,
        totalCost,
        totalAccumulated,
        totalNBV:   totalCost.minus(totalAccumulated),
        byCategory: [...byCategory.entries()].map(([category, v]) => ({
          category,
          cost:        v.cost,
          accumulated: v.accumulated,
          nbv:         v.cost.minus(v.accumulated),
          count:       v.count,
        })),
      }
    }),
})
