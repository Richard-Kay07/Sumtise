/**
 * Period-End / Month-End Close Router
 *
 * Manages accounting periods (1-12 regular + 13-16 SAP-style adjustment),
 * period lock/close workflow, accrual posting with auto-reversal, and
 * year-end closing entries (revenue/expense → retained earnings).
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { postDoubleEntry } from "@/lib/posting"
import { Prisma, PeriodStatus, AccrualStatus, AccrualType, ClosingEntryType } from "@prisma/client"
import { addMonths, startOfMonth, endOfMonth, format, addDays } from "date-fns"

// ─── Period naming helpers ────────────────────────────────────────────────────

const ADJUSTMENT_PERIOD_NAMES: Record<number, string> = {
  13: "YE Adj I — Pre-Audit",
  14: "YE Adj II — Post-Audit",
  15: "YE Adj III — Tax",
  16: "YE Adj IV — Final Close",
}

function periodName(fiscalYear: number, periodNumber: number, fiscalYearStartMonth: number): string {
  if (periodNumber >= 13) return `${ADJUSTMENT_PERIOD_NAMES[periodNumber]} ${fiscalYear}`
  // Map period number to calendar month
  const monthIndex = ((fiscalYearStartMonth - 1 + periodNumber - 1) % 12)
  const calYear = fiscalYear + (fiscalYearStartMonth - 1 + periodNumber - 1 >= 12 ? 1 : 0)
  const date = new Date(calYear, monthIndex, 1)
  return format(date, "MMMM yyyy")
}

function periodDates(fiscalYear: number, periodNumber: number, fiscalYearStartMonth: number) {
  if (periodNumber >= 13) {
    // Adjustment periods: placed after the fiscal year ends
    const yearEndMonth = ((fiscalYearStartMonth - 2 + 12) % 12) + 1
    const yearEndCalYear = yearEndMonth < fiscalYearStartMonth ? fiscalYear + 1 : fiscalYear
    const base = endOfMonth(new Date(yearEndCalYear, yearEndMonth - 1, 1))
    // Each adj period is 1 day wide starting after FY end
    const offset = periodNumber - 13
    const start = addDays(base, offset + 1)
    return { startDate: start, endDate: start }
  }
  const monthIndex = ((fiscalYearStartMonth - 1 + periodNumber - 1) % 12)
  const calYear = fiscalYear + (fiscalYearStartMonth - 1 + periodNumber - 1 >= 12 ? 1 : 0)
  const d = new Date(calYear, monthIndex, 1)
  return { startDate: startOfMonth(d), endDate: endOfMonth(d) }
}

// ─── Retained earnings account lookup ────────────────────────────────────────

async function getRetainedEarningsAccount(orgId: string) {
  const acct = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId: orgId,
      type: "EQUITY",
      isActive: true,
      OR: [
        { name: { contains: "retained", mode: "insensitive" } },
        { name: { contains: "reserves", mode: "insensitive" } },
        { code: { in: ["3100", "3200", "31000", "32000"] } },
      ],
    },
  })
  return acct ?? null
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const periodEndRouter = createTRPCRouter({

  // ── List periods for a fiscal year ────────────────────────────────────────

  listPeriods: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      fiscalYear: z.number().int().min(2000).max(2100),
    }))
    .query(async ({ ctx, input }) => {
      const periods = await prisma.accountingPeriod.findMany({
        where: { organizationId: ctx.organizationId, fiscalYear: input.fiscalYear },
        orderBy: { periodNumber: "asc" },
        include: {
          _count: { select: { transactions: true, accruals: true, closingEntries: true } },
        },
      })
      return periods
    }),

  // ── List all fiscal years that have periods ────────────────────────────────

  listFiscalYears: orgScopedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx }) => {
      const rows = await prisma.accountingPeriod.groupBy({
        by: ["fiscalYear"],
        where: { organizationId: ctx.organizationId },
        orderBy: { fiscalYear: "desc" },
      })
      return rows.map(r => r.fiscalYear)
    }),

  // ── Generate all periods for a fiscal year ────────────────────────────────

  generateFiscalYear: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      fiscalYear: z.number().int().min(2000).max(2100),
      fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
      includeAdjustmentPeriods: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { fiscalYear, fiscalYearStartMonth, includeAdjustmentPeriods } = input
      const maxPeriod = includeAdjustmentPeriods ? 16 : 12
      const created: string[] = []

      for (let p = 1; p <= maxPeriod; p++) {
        const isAdj = p >= 13
        const name = periodName(fiscalYear, p, fiscalYearStartMonth)
        const { startDate, endDate } = periodDates(fiscalYear, p, fiscalYearStartMonth)

        await prisma.accountingPeriod.upsert({
          where: { organizationId_fiscalYear_periodNumber: {
            organizationId: ctx.organizationId, fiscalYear, periodNumber: p,
          }},
          update: {},
          create: {
            organizationId: ctx.organizationId,
            fiscalYear,
            periodNumber: p,
            name,
            startDate,
            endDate,
            status: PeriodStatus.OPEN,
            isAdjustment: isAdj,
          },
        })
        created.push(name)
      }

      return { created: created.length, periods: created }
    }),

  // ── Get a single period ────────────────────────────────────────────────────

  getPeriod: orgScopedProcedure
    .input(z.object({ organizationId: z.string(), periodId: z.string() }))
    .query(async ({ ctx, input }) => {
      const period = await prisma.accountingPeriod.findUnique({
        where: { id: input.periodId },
        include: {
          accruals: {
            include: {
              reversalPeriod: { select: { id: true, name: true } },
            },
          },
          closingEntries: true,
          _count: { select: { transactions: true } },
        },
      })
      if (!period || period.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Period not found" })
      }
      return period
    }),

  // ── Lock a period (soft close — no new postings) ──────────────────────────

  lockPeriod: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string(), periodId: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const period = await prisma.accountingPeriod.findUnique({ where: { id: input.periodId } })
      if (!period || period.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Period not found" })
      }
      if (period.status !== PeriodStatus.OPEN) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Period is already ${period.status}` })
      }

      const updated = await prisma.accountingPeriod.update({
        where: { id: input.periodId },
        data: {
          status: PeriodStatus.LOCKED,
          lockedAt: new Date(),
          lockedBy: ctx.session.user.id,
          notes: input.notes,
        },
      })

      await recordAudit({
        entity: "accountingPeriod", entityId: input.periodId, action: "lock",
        before: period, after: updated,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        details: `Locked period: ${period.name}`,
      }).catch(() => {})

      return updated
    }),

  // ── Unlock a period (re-open a locked period) ─────────────────────────────

  unlockPeriod: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({ organizationId: z.string(), periodId: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const period = await prisma.accountingPeriod.findUnique({ where: { id: input.periodId } })
      if (!period || period.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Period not found" })
      }
      if (period.status === PeriodStatus.CLOSED) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot re-open a CLOSED period. Use a prior-period adjustment." })
      }

      return prisma.accountingPeriod.update({
        where: { id: input.periodId },
        data: { status: PeriodStatus.OPEN, lockedAt: null, lockedBy: null, notes: input.notes },
      })
    }),

  // ── Close a period (post closing entries + archive) ───────────────────────

  closePeriod: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.SETTINGS_EDIT))
    .input(z.object({
      organizationId: z.string(),
      periodId: z.string(),
      postClosingEntries: z.boolean().default(true),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const period = await prisma.accountingPeriod.findUnique({ where: { id: input.periodId } })
      if (!period || period.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Period not found" })
      }
      if (period.status === PeriodStatus.CLOSED) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Period is already closed" })
      }
      // Must be locked first
      if (period.status !== PeriodStatus.LOCKED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Period must be LOCKED before closing. Lock it first to prevent new postings.",
        })
      }

      const closingEntryIds: string[] = []

      if (input.postClosingEntries) {
        const reAccount = await getRetainedEarningsAccount(ctx.organizationId)
        if (!reAccount) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Retained Earnings account not found. Create an EQUITY account named 'Retained Earnings' in your chart of accounts.",
          })
        }

        // Aggregate all REVENUE and EXPENSE transactions in this period
        const txns = await prisma.transaction.findMany({
          where: {
            organizationId: ctx.organizationId,
            date: { gte: period.startDate, lte: period.endDate },
          },
          include: { account: { select: { id: true, type: true, name: true } } },
        })

        // Net per account
        const revenueByAccount = new Map<string, { name: string; net: number }>()
        const expenseByAccount = new Map<string, { name: string; net: number }>()

        for (const tx of txns) {
          const net = Number(tx.credit) - Number(tx.debit)
          if (tx.account.type === "REVENUE" && net !== 0) {
            const prev = revenueByAccount.get(tx.accountId) ?? { name: tx.account.name, net: 0 }
            revenueByAccount.set(tx.accountId, { name: prev.name, net: prev.net + net })
          }
          if (tx.account.type === "EXPENSE" && net !== 0) {
            const prev = expenseByAccount.get(tx.accountId) ?? { name: tx.account.name, net: 0 }
            expenseByAccount.set(tx.accountId, { name: prev.name, net: prev.net + net })
          }
        }

        const closeDate = period.endDate

        // ── Revenue closing: DR each Revenue account, CR Retained Earnings ──
        const revAccounts = [...revenueByAccount.entries()].filter(([, v]) => v.net > 0)
        if (revAccounts.length > 0) {
          const totalRevenue = revAccounts.reduce((s, [, v]) => s + v.net, 0)
          const revLines = [
            ...revAccounts.map(([accountId, v]) => ({
              accountId,
              debit: Math.round(v.net * 100) / 100,
              credit: 0,
              description: `Period close — ${v.name}`,
              reference: `CLOSE-${period.fiscalYear}-P${String(period.periodNumber).padStart(2, "0")}`,
            })),
            {
              accountId: reAccount.id,
              debit: 0,
              credit: Math.round(totalRevenue * 100) / 100,
              description: `Period close — net revenue to retained earnings`,
              reference: `CLOSE-${period.fiscalYear}-P${String(period.periodNumber).padStart(2, "0")}`,
            },
          ]

          const result = await postDoubleEntry({
            date: closeDate,
            lines: revLines,
            docRef: `CLOSE-REV-${period.id}`,
            currency: "GBP",
            rate: 1.0,
            orgId: ctx.organizationId,
            userId: ctx.session.user.id,
            description: `Period close — revenue accounts: ${period.name}`,
            metadata: { periodId: period.id, closingType: "REVENUE_CLOSE" },
          })

          const ce = await prisma.closingEntry.create({
            data: {
              organizationId: ctx.organizationId,
              periodId: period.id,
              type: ClosingEntryType.REVENUE_CLOSE,
              transactionIds: result.transactionIds,
              grossAmount: totalRevenue,
              retainedEarningsAccountId: reAccount.id,
            },
          })
          closingEntryIds.push(ce.id)
        }

        // ── Expense closing: CR each Expense account, DR Retained Earnings ──
        const expAccounts = [...expenseByAccount.entries()].filter(([, v]) => v.net < 0)
        if (expAccounts.length > 0) {
          const totalExpenses = Math.abs(expAccounts.reduce((s, [, v]) => s + v.net, 0))
          const expLines = [
            {
              accountId: reAccount.id,
              debit: Math.round(totalExpenses * 100) / 100,
              credit: 0,
              description: `Period close — net expenses from retained earnings`,
              reference: `CLOSE-${period.fiscalYear}-P${String(period.periodNumber).padStart(2, "0")}`,
            },
            ...expAccounts.map(([accountId, v]) => ({
              accountId,
              debit: 0,
              credit: Math.round(Math.abs(v.net) * 100) / 100,
              description: `Period close — ${expenseByAccount.get(accountId)?.name}`,
              reference: `CLOSE-${period.fiscalYear}-P${String(period.periodNumber).padStart(2, "0")}`,
            })),
          ]

          const result = await postDoubleEntry({
            date: closeDate,
            lines: expLines,
            docRef: `CLOSE-EXP-${period.id}`,
            currency: "GBP",
            rate: 1.0,
            orgId: ctx.organizationId,
            userId: ctx.session.user.id,
            description: `Period close — expense accounts: ${period.name}`,
            metadata: { periodId: period.id, closingType: "EXPENSE_CLOSE" },
          })

          const ce = await prisma.closingEntry.create({
            data: {
              organizationId: ctx.organizationId,
              periodId: period.id,
              type: ClosingEntryType.EXPENSE_CLOSE,
              transactionIds: result.transactionIds,
              grossAmount: totalExpenses,
              retainedEarningsAccountId: reAccount.id,
            },
          })
          closingEntryIds.push(ce.id)
        }
      }

      const updated = await prisma.accountingPeriod.update({
        where: { id: input.periodId },
        data: {
          status: PeriodStatus.CLOSED,
          closedAt: new Date(),
          closedBy: ctx.session.user.id,
          notes: input.notes,
        },
      })

      await recordAudit({
        entity: "accountingPeriod", entityId: input.periodId, action: "close",
        before: period, after: updated,
        organizationId: ctx.organizationId, userId: ctx.session.user.id,
        details: `Closed period: ${period.name}. Closing entries: ${closingEntryIds.length}`,
      }).catch(() => {})

      return { period: updated, closingEntryCount: closingEntryIds.length }
    }),

  // ── Accrual management ────────────────────────────────────────────────────

  listAccruals: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      periodId: z.string().optional(),
      status: z.nativeEnum(AccrualStatus).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return prisma.accrualEntry.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(input.periodId && { periodId: input.periodId }),
          ...(input.status && { status: input.status }),
        },
        include: {
          period: { select: { id: true, name: true, fiscalYear: true, periodNumber: true } },
          reversalPeriod: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    }),

  createAccrual: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      periodId: z.string(),
      description: z.string().min(1),
      amount: z.number().min(0.01),
      currency: z.string().default("GBP"),
      debitAccountId: z.string(),
      creditAccountId: z.string(),
      type: z.nativeEnum(AccrualType),
      reference: z.string().optional(),
      autoReverse: z.boolean().default(true),
      reversalPeriodId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const period = await prisma.accountingPeriod.findUnique({ where: { id: input.periodId } })
      if (!period || period.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Period not found" })
      }

      return prisma.accrualEntry.create({
        data: {
          organizationId: ctx.organizationId,
          periodId: input.periodId,
          description: input.description,
          amount: new Prisma.Decimal(input.amount),
          currency: input.currency,
          debitAccountId: input.debitAccountId,
          creditAccountId: input.creditAccountId,
          type: input.type,
          reference: input.reference,
          autoReverse: input.autoReverse,
          reversalPeriodId: input.reversalPeriodId ?? null,
          notes: input.notes,
        },
      })
    }),

  postAccrual: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({ organizationId: z.string(), accrualId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const accrual = await prisma.accrualEntry.findUnique({
        where: { id: input.accrualId },
        include: { period: true },
      })
      if (!accrual || accrual.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Accrual not found" })
      }
      if (accrual.status !== AccrualStatus.DRAFT) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Accrual is already ${accrual.status}` })
      }

      const amt = Number(accrual.amount)
      const result = await postDoubleEntry({
        date: accrual.period.endDate,
        lines: [
          { accountId: accrual.debitAccountId, debit: amt, credit: 0, description: accrual.description, reference: accrual.reference ?? undefined },
          { accountId: accrual.creditAccountId, debit: 0, credit: amt, description: accrual.description, reference: accrual.reference ?? undefined },
        ],
        docRef: `ACCR-${accrual.id}`,
        currency: accrual.currency,
        rate: 1.0,
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
        description: `Accrual: ${accrual.description}`,
        metadata: { accrualId: accrual.id, periodId: accrual.periodId, type: accrual.type },
      })

      return prisma.accrualEntry.update({
        where: { id: input.accrualId },
        data: { status: AccrualStatus.POSTED, postingTransactionIds: result.transactionIds },
      })
    }),

  reverseAccrual: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.TRANSACTIONS_CREATE))
    .input(z.object({
      organizationId: z.string(),
      accrualId: z.string(),
      reversalPeriodId: z.string(),
      reversalDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const accrual = await prisma.accrualEntry.findUnique({
        where: { id: input.accrualId },
        include: { period: true },
      })
      if (!accrual || accrual.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Accrual not found" })
      }
      if (accrual.status !== AccrualStatus.POSTED) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only POSTED accruals can be reversed" })
      }

      const reversalPeriod = await prisma.accountingPeriod.findUnique({ where: { id: input.reversalPeriodId } })
      if (!reversalPeriod || reversalPeriod.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reversal period not found" })
      }

      const revDate = input.reversalDate ?? reversalPeriod.startDate
      const amt = Number(accrual.amount)

      const result = await postDoubleEntry({
        date: revDate,
        lines: [
          // Swap DR/CR to reverse the original entry
          { accountId: accrual.creditAccountId, debit: amt, credit: 0, description: `Reversal: ${accrual.description}`, reference: accrual.reference ?? undefined },
          { accountId: accrual.debitAccountId, debit: 0, credit: amt, description: `Reversal: ${accrual.description}`, reference: accrual.reference ?? undefined },
        ],
        docRef: `REV-ACCR-${accrual.id}`,
        currency: accrual.currency,
        rate: 1.0,
        orgId: ctx.organizationId,
        userId: ctx.session.user.id,
        description: `Accrual reversal: ${accrual.description}`,
        metadata: { accrualId: accrual.id, reversalOf: accrual.id, type: accrual.type },
      })

      return prisma.accrualEntry.update({
        where: { id: input.accrualId },
        data: {
          status: AccrualStatus.REVERSED,
          reversalPeriodId: input.reversalPeriodId,
          reversalTransactionIds: result.transactionIds,
          reversalDate: revDate,
        },
      })
    }),

  // ── Period summary stats (for the UI dashboard) ───────────────────────────

  getPeriodSummary: orgScopedProcedure
    .input(z.object({ organizationId: z.string(), periodId: z.string() }))
    .query(async ({ ctx, input }) => {
      const period = await prisma.accountingPeriod.findUnique({ where: { id: input.periodId } })
      if (!period || period.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Period not found" })
      }

      const txns = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date: { gte: period.startDate, lte: period.endDate },
        },
        include: { account: { select: { type: true } } },
      })

      let revenue = 0, expenses = 0, totalDebit = 0, totalCredit = 0
      for (const tx of txns) {
        totalDebit += Number(tx.debit)
        totalCredit += Number(tx.credit)
        if (tx.account.type === "REVENUE") revenue += Number(tx.credit) - Number(tx.debit)
        if (tx.account.type === "EXPENSE") expenses += Number(tx.debit) - Number(tx.credit)
      }

      const accrualCount = await prisma.accrualEntry.count({
        where: { organizationId: ctx.organizationId, periodId: input.periodId },
      })

      return {
        period,
        transactionCount: txns.length,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        netProfit: Math.round((revenue - expenses) * 100) / 100,
        accrualCount,
      }
    }),
})
