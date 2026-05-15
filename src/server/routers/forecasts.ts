import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isAfter, isBefore, isSameMonth } from "date-fns"

// Returns how many times a recurring invoice fires in a given calendar month
function recurringFireCountInMonth(frequency: string, startDate: Date, month: Date): number {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)

  if (isBefore(monthEnd, startOfMonth(startDate))) return 0

  switch (frequency) {
    case "WEEKLY":
      return 4 // ~4 per month; conservative average
    case "FORTNIGHTLY":
      return 2
    case "MONTHLY":
      return 1
    case "QUARTERLY": {
      const startMonth = startDate.getMonth()
      const targetMonth = month.getMonth()
      return ((targetMonth - startMonth) % 3 + 3) % 3 === 0 ? 1 : 0
    }
    case "ANNUALLY":
      return startDate.getMonth() === month.getMonth() ? 1 : 0
    default:
      return 0
  }
}

export const forecastsRouter = createTRPCRouter({
  getCashFlowForecast: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.REPORTS_VIEW))
    .input(z.object({
      organizationId: z.string(),
      historicalMonths: z.number().min(3).max(24).default(6),
      forecastMonths: z.number().min(1).max(12).default(6),
    }))
    .query(async ({ ctx, input }) => {
      const { historicalMonths, forecastMonths } = input
      const now = new Date()
      const historyStart = startOfMonth(subMonths(now, historicalMonths))
      const historyEnd = endOfMonth(subMonths(now, 1))

      // Pull all transactions in the historical window with account type
      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId: ctx.organizationId,
          date: { gte: historyStart, lte: historyEnd },
        },
        include: { account: { select: { type: true } } },
        orderBy: { date: "asc" },
      })

      // Group by month → revenue & expenses
      const monthlyData: Record<string, { revenue: number; expenses: number }> = {}
      for (const tx of transactions) {
        const key = format(new Date(tx.date), "yyyy-MM")
        if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expenses: 0 }
        if (tx.account?.type === "REVENUE") monthlyData[key].revenue += Number(tx.credit)
        if (tx.account?.type === "EXPENSE") monthlyData[key].expenses += Number(tx.debit)
      }

      // Fill any missing months with zero so averages are fair
      for (let i = 0; i < historicalMonths; i++) {
        const key = format(startOfMonth(subMonths(now, historicalMonths - i)), "yyyy-MM")
        if (!monthlyData[key]) monthlyData[key] = { revenue: 0, expenses: 0 }
      }

      const historicalValues = Object.values(monthlyData)
      const avgRevenue = historicalValues.reduce((s, m) => s + m.revenue, 0) / historicalValues.length
      const avgExpenses = historicalValues.reduce((s, m) => s + m.expenses, 0) / historicalValues.length

      // Simple linear-regression slope for revenue trend
      const revenueArr = Object.keys(monthlyData).sort().map(k => monthlyData[k].revenue)
      const revenueSlope = revenueArr.length >= 2
        ? (revenueArr[revenueArr.length - 1] - revenueArr[0]) / (revenueArr.length - 1)
        : 0
      const expenseArr = Object.keys(monthlyData).sort().map(k => monthlyData[k].expenses)
      const expenseSlope = expenseArr.length >= 2
        ? (expenseArr[expenseArr.length - 1] - expenseArr[0]) / (expenseArr.length - 1)
        : 0

      // Fetch active recurring invoices
      const recurringInvoices = await prisma.recurringInvoice.findMany({
        where: { organizationId: ctx.organizationId, status: "ACTIVE" },
        select: {
          frequency: true, startDate: true, endDate: true,
          total: true, templateName: true,
        },
      })

      // Pre-compute recurring revenue per future month
      const recurringByMonth: Record<string, number> = {}
      for (let i = 0; i < forecastMonths; i++) {
        const month = addMonths(startOfMonth(now), i)
        const key = format(month, "yyyy-MM")
        recurringByMonth[key] = 0
        for (const ri of recurringInvoices) {
          if (ri.endDate && isAfter(month, endOfMonth(ri.endDate))) continue
          const count = recurringFireCountInMonth(ri.frequency, new Date(ri.startDate), month)
          recurringByMonth[key] += count * Number(ri.total)
        }
      }

      // Fetch outstanding invoices — expected collections by due date
      const outstandingInvoices = await prisma.invoice.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["SENT", "OVERDUE"] },
        },
        select: { dueDate: true, total: true },
      })

      const outstandingByMonth: Record<string, number> = {}
      for (const inv of outstandingInvoices) {
        const key = format(new Date(inv.dueDate), "yyyy-MM")
        outstandingByMonth[key] = (outstandingByMonth[key] ?? 0) + Number(inv.total)
      }

      // Fetch outstanding bills — expected payments by due date
      const outstandingBills = await prisma.bill.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["APPROVED", "PART_PAID", "OVERDUE"] },
        },
        select: { dueDate: true, total: true },
      })

      const billsByMonth: Record<string, number> = {}
      for (const bill of outstandingBills) {
        const key = format(new Date(bill.dueDate), "yyyy-MM")
        billsByMonth[key] = (billsByMonth[key] ?? 0) + Number(bill.total)
      }

      // Build historical months
      const historical = []
      for (let i = historicalMonths - 1; i >= 0; i--) {
        const month = subMonths(startOfMonth(now), i + 1)
        const key = format(month, "yyyy-MM")
        const d = monthlyData[key] ?? { revenue: 0, expenses: 0 }
        historical.push({
          month: key,
          label: format(month, "MMM yy"),
          revenue: Math.round(d.revenue),
          expenses: Math.round(d.expenses),
          profit: Math.round(d.revenue - d.expenses),
          type: "historical" as const,
        })
      }

      // Build forecast months (trend-adjusted: avg + slope × months ahead)
      const forecast = []
      let runningCash = 0
      for (let i = 0; i < forecastMonths; i++) {
        const month = addMonths(startOfMonth(now), i)
        const key = format(month, "yyyy-MM")
        const trendRevenue = Math.max(0, avgRevenue + revenueSlope * (i + 1))
        const trendExpenses = Math.max(0, avgExpenses + expenseSlope * (i + 1))
        const recurring = recurringByMonth[key] ?? 0
        const collections = outstandingByMonth[key] ?? 0
        const bills = billsByMonth[key] ?? 0

        const netRevenue = Math.round(trendRevenue + recurring)
        const netExpenses = Math.round(trendExpenses + bills)
        const cashInflow = Math.round(netRevenue + collections)
        const profit = netRevenue - netExpenses
        runningCash += cashInflow - netExpenses

        forecast.push({
          month: key,
          label: format(month, "MMM yy"),
          revenue: netRevenue,
          expenses: netExpenses,
          profit: Math.round(profit),
          recurringRevenue: Math.round(recurring),
          outstandingCollection: Math.round(collections),
          scheduledBills: Math.round(bills),
          cashInflow,
          cumulativeCash: Math.round(runningCash),
          type: "forecast" as const,
        })
      }

      const totalOutstanding = Object.values(outstandingByMonth).reduce((s, v) => s + v, 0)

      return {
        historical,
        forecast,
        summary: {
          avgMonthlyRevenue: Math.round(avgRevenue),
          avgMonthlyExpenses: Math.round(avgExpenses),
          avgMonthlyProfit: Math.round(avgRevenue - avgExpenses),
          totalForecastRevenue: forecast.reduce((s, m) => s + m.revenue, 0),
          totalForecastExpenses: forecast.reduce((s, m) => s + m.expenses, 0),
          totalForecastProfit: forecast.reduce((s, m) => s + m.profit, 0),
          totalRecurringRevenue: forecast.reduce((s, m) => s + m.recurringRevenue, 0),
          totalOutstandingCollection: Math.round(totalOutstanding),
          activeRecurringTemplates: recurringInvoices.length,
          revenuetrend: revenueSlope >= 0 ? "up" : "down",
          expenseTrend: expenseSlope >= 0 ? "up" : "down",
        },
      }
    }),
})
