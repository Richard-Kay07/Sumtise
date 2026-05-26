import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { startOfMonth, subMonths, endOfMonth } from 'date-fns'

export const FPNA_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_budget_vs_actual',
    description: 'Compare budget vs actual spend by account or account type for a given period. Returns variance amounts and percentages.',
    input_schema: {
      type: 'object',
      properties: {
        periodStart:   { type: 'string', description: 'Start date YYYY-MM-DD' },
        periodEnd:     { type: 'string', description: 'End date YYYY-MM-DD' },
        accountType:   { type: 'string', enum: ['EXPENSE', 'REVENUE', 'ASSET', 'LIABILITY', 'EQUITY'], description: 'Filter by account type' },
        topN:          { type: 'number', description: 'Return top N accounts by adverse variance (default 10)' },
      },
    },
  },
  {
    name: 'get_historical_cashflow',
    description: 'Get monthly cash inflow and outflow totals over the past N months. Used as the basis for trend analysis and forecasting.',
    input_schema: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Number of historical months to return (default 12, max 24)' },
      },
    },
  },
  {
    name: 'get_period_comparison',
    description: 'Compare two periods (e.g. current month vs same month last year, or current quarter vs last quarter). Returns revenue, expenses, and net for each period.',
    input_schema: {
      type: 'object',
      required: ['period1Start', 'period1End', 'period2Start', 'period2End'],
      properties: {
        period1Start: { type: 'string', description: 'First period start YYYY-MM-DD' },
        period1End:   { type: 'string', description: 'First period end YYYY-MM-DD' },
        period2Start: { type: 'string', description: 'Second period start YYYY-MM-DD' },
        period2End:   { type: 'string', description: 'Second period end YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'get_forecast_data',
    description: 'Get the existing cash flow forecast including recurring invoice projections. Returns projected monthly figures for the next N months.',
    input_schema: {
      type: 'object',
      properties: {
        forecastMonths: { type: 'number', description: 'Number of months to project (default 6, max 12)' },
      },
    },
  },
]

export async function executeFpnaTool(
  name: string,
  args: Record<string, any>,
  organizationId: string
): Promise<unknown> {
  switch (name) {
    case 'get_budget_vs_actual':   return getBudgetVsActual(args, organizationId)
    case 'get_historical_cashflow': return getHistoricalCashflow(args, organizationId)
    case 'get_period_comparison':   return getPeriodComparison(args, organizationId)
    case 'get_forecast_data':       return getForecastData(args, organizationId)
    default: return { error: `Unknown tool: ${name}` }
  }
}

async function getBudgetVsActual(args: any, orgId: string) {
  const start = new Date(args.periodStart ?? subMonths(new Date(), 1))
  const end = new Date(args.periodEnd ?? endOfMonth(subMonths(new Date(), 1)))
  const topN = args.topN ?? 10

  const budgets = await prisma.budget.findMany({
    where: { organizationId: orgId },
    include: { lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } } },
    take: 5,
  })

  const actuals = await prisma.transaction.groupBy({
    by: ['accountId'],
    where: { organizationId: orgId, date: { gte: start, lte: end } },
    _sum: { debit: true, credit: true },
  })

  const actualsMap = new Map(actuals.map(a => [a.accountId, {
    debit: Number(a._sum.debit ?? 0),
    credit: Number(a._sum.credit ?? 0),
  }]))

  const allBudgetLines = budgets.flatMap(b => b.lines)
  const filtered = args.accountType
    ? allBudgetLines.filter(l => l.account.type === args.accountType)
    : allBudgetLines

  const variances = filtered.map(line => {
    const actual = actualsMap.get(line.accountId)
    const actualNet = (actual?.debit ?? 0) - (actual?.credit ?? 0)
    const budgeted = Number(line.amount)
    const variance = actualNet - budgeted
    const pct = budgeted !== 0 ? (variance / Math.abs(budgeted)) * 100 : 0
    return {
      account: `[${line.account.code}] ${line.account.name}`,
      type: line.account.type,
      budgeted,
      actual: actualNet,
      variance,
      variancePct: Math.round(pct * 10) / 10,
      adverse: (line.account.type === 'EXPENSE' && variance > 0) || (line.account.type === 'REVENUE' && variance < 0),
    }
  })
    .sort((a, b) => (b.adverse ? 1 : -1) - (a.adverse ? 1 : -1) || Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, topN)

  return { periodStart: start.toISOString().split('T')[0], periodEnd: end.toISOString().split('T')[0], variances }
}

async function getHistoricalCashflow(args: any, orgId: string) {
  const months = Math.min(args.months ?? 12, 24)
  const result = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))

    const totals = await prisma.transaction.aggregate({
      where: { organizationId: orgId, date: { gte: monthStart, lte: monthEnd } },
      _sum: { debit: true, credit: true },
    })

    const revenueCredit = await prisma.transaction.aggregate({
      where: {
        organizationId: orgId,
        date: { gte: monthStart, lte: monthEnd },
        account: { type: 'REVENUE' },
      },
      _sum: { credit: true, debit: true },
    })

    const expenseDebit = await prisma.transaction.aggregate({
      where: {
        organizationId: orgId,
        date: { gte: monthStart, lte: monthEnd },
        account: { type: 'EXPENSE' },
      },
      _sum: { debit: true, credit: true },
    })

    const revenue = Number(revenueCredit._sum.credit ?? 0) - Number(revenueCredit._sum.debit ?? 0)
    const expenses = Number(expenseDebit._sum.debit ?? 0) - Number(expenseDebit._sum.credit ?? 0)

    result.push({
      month: monthStart.toISOString().slice(0, 7),
      revenue,
      expenses,
      net: revenue - expenses,
    })
  }

  return { months: result }
}

async function getPeriodComparison(args: any, orgId: string) {
  async function periodSummary(start: Date, end: Date) {
    const revenue = await prisma.transaction.aggregate({
      where: { organizationId: orgId, date: { gte: start, lte: end }, account: { type: 'REVENUE' } },
      _sum: { credit: true, debit: true },
    })
    const expenses = await prisma.transaction.aggregate({
      where: { organizationId: orgId, date: { gte: start, lte: end }, account: { type: 'EXPENSE' } },
      _sum: { debit: true, credit: true },
    })
    const rev = Number(revenue._sum.credit ?? 0) - Number(revenue._sum.debit ?? 0)
    const exp = Number(expenses._sum.debit ?? 0) - Number(expenses._sum.credit ?? 0)
    return { revenue: rev, expenses: exp, net: rev - exp }
  }

  const [p1, p2] = await Promise.all([
    periodSummary(new Date(args.period1Start), new Date(args.period1End)),
    periodSummary(new Date(args.period2Start), new Date(args.period2End)),
  ])

  return {
    period1: { start: args.period1Start, end: args.period1End, ...p1 },
    period2: { start: args.period2Start, end: args.period2End, ...p2 },
    revenueChange: p1.revenue - p2.revenue,
    expensesChange: p1.expenses - p2.expenses,
    netChange: p1.net - p2.net,
  }
}

async function getForecastData(args: any, orgId: string) {
  const forecastMonths = Math.min(args.forecastMonths ?? 6, 12)
  const now = new Date()

  const recurringInvoices = await prisma.recurringInvoice.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { frequency: true, amount: true, nextDate: true },
    take: 50,
  })

  const months = []
  for (let i = 0; i < forecastMonths; i++) {
    const monthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() + i, 1))
    const projected = recurringInvoices.reduce((sum, inv) => {
      if (inv.nextDate && inv.nextDate <= endOfMonth(monthStart)) {
        const n = inv.frequency === 'WEEKLY' ? 4 : inv.frequency === 'MONTHLY' ? 1 : inv.frequency === 'QUARTERLY' ? (i % 3 === 0 ? 1 : 0) : 0
        return sum + Number(inv.amount) * n
      }
      return sum
    }, 0)
    months.push({ month: monthStart.toISOString().slice(0, 7), projectedRevenue: projected })
  }

  return { forecastMonths: months }
}
