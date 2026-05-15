import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { upsertRate, resolveRate } from "@/lib/finance/fxDb"

async function getOrCreateModuleSettings(orgId: string) {
  let s = await prisma.orgModuleSettings.findUnique({ where: { orgId } })
  if (!s) s = await prisma.orgModuleSettings.create({ data: { orgId } })
  return s
}

export const fxRatesRouter = createTRPCRouter({
  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings: orgScopedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      return getOrCreateModuleSettings(ctx.organizationId)
    }),

  updateSettings: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      functionalCurrency: z.string().length(3).optional(),
      fxGainLossAccountId: z.string().optional().nullable(),
      enableMultiCurrencyFX: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { functionalCurrency, fxGainLossAccountId, enableMultiCurrencyFX } = input
      return prisma.orgModuleSettings.upsert({
        where: { orgId: ctx.organizationId },
        update: {
          ...(functionalCurrency !== undefined && { functionalCurrency }),
          ...(fxGainLossAccountId !== undefined && { fxGainLossAccountId }),
          ...(enableMultiCurrencyFX !== undefined && { enableMultiCurrencyFX }),
        },
        create: {
          orgId: ctx.organizationId,
          ...(functionalCurrency && { functionalCurrency }),
          ...(fxGainLossAccountId && { fxGainLossAccountId }),
          ...(enableMultiCurrencyFX !== undefined && { enableMultiCurrencyFX }),
        },
      })
    }),

  // ── Rate CRUD ─────────────────────────────────────────────────────────────

  list: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      fromCurrency: z.string().optional(),
      toCurrency: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { fromCurrency, toCurrency, dateFrom, dateTo, page, limit } = input
      const where: any = { orgId: ctx.organizationId }
      if (fromCurrency) where.fromCurrency = fromCurrency
      if (toCurrency) where.toCurrency = toCurrency
      if (dateFrom || dateTo) {
        where.date = {}
        if (dateFrom) where.date.gte = dateFrom
        if (dateTo) where.date.lte = dateTo
      }

      const [rates, total] = await Promise.all([
        prisma.fxRate.findMany({
          where,
          orderBy: [{ date: "desc" }, { fromCurrency: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.fxRate.count({ where }),
      ])

      return { rates, total, pages: Math.ceil(total / limit) }
    }),

  upsert: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      fromCurrency: z.string().length(3),
      toCurrency: z.string().length(3),
      rate: z.number().min(0.000001),
      date: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { fromCurrency, toCurrency, rate, date } = input
      if (fromCurrency === toCurrency) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "From and to currency must differ" })
      }
      return upsertRate(ctx.organizationId, fromCurrency, toCurrency, rate, date, "MANUAL")
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string(), id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const row = await prisma.fxRate.findUnique({ where: { id: input.id } })
      if (!row || row.orgId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rate not found" })
      }
      await prisma.fxRate.delete({ where: { id: input.id } })
      return { success: true }
    }),

  // ── Resolve a specific rate ───────────────────────────────────────────────

  resolve: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      fromCurrency: z.string(),
      toCurrency: z.string(),
      date: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const { fromCurrency, toCurrency, date } = input
      const resolved = await resolveRate(ctx.organizationId, fromCurrency, toCurrency, date)
      return resolved ?? null
    }),

  // ── Sync from ECB ─────────────────────────────────────────────────────────

  syncEcb: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx }) => {
      const { syncEcbRates } = await import("@/lib/finance/fxFetch")
      const result = await syncEcbRates(ctx.organizationId)
      return result
    }),
})
