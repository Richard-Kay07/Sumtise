import { prisma } from "@/lib/prisma"

export interface FinancialContext {
  organizationName: string
  currency: string
  periodStart: Date
  periodEnd: Date
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalReceivables: number
  totalPayables: number
  topExpenseAccounts: Array<{ name: string; code: string; total: number }>
  topRevenueAccounts: Array<{ name: string; code: string; total: number }>
  overdueInvoiceCount: number
  overdueInvoiceTotal: number
  overdueBillCount: number
  overdueBillTotal: number
  recentTransactionCount: number
}

export async function buildFinancialContext(organizationId: string): Promise<FinancialContext> {
  const now = new Date()
  const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, metadata: true },
  })

  const orgMeta = (org.metadata as any) ?? {}
  const currency: string = orgMeta.currency ?? "GBP"

  // Last 12 months of transactions with account type
  const txns = await prisma.transaction.findMany({
    where: {
      organizationId,
      date: { gte: twelveMonthsAgo, lte: now },
    },
    select: {
      debit: true,
      credit: true,
      account: { select: { type: true, name: true, code: true } },
    },
  })

  let totalRevenue = 0
  let totalExpenses = 0
  const expenseByAccount = new Map<string, { name: string; code: string; total: number }>()
  const revenueByAccount = new Map<string, { name: string; code: string; total: number }>()

  for (const tx of txns) {
    const type = tx.account?.type
    const name = tx.account?.name ?? "Unknown"
    const code = tx.account?.code ?? ""
    const debit = Number(tx.debit ?? 0)
    const credit = Number(tx.credit ?? 0)

    if (type === "REVENUE") {
      const net = credit - debit
      if (net > 0) {
        totalRevenue += net
        const existing = revenueByAccount.get(code)
        revenueByAccount.set(code, { name, code, total: (existing?.total ?? 0) + net })
      }
    } else if (type === "EXPENSE") {
      const net = debit - credit
      if (net > 0) {
        totalExpenses += net
        const existing = expenseByAccount.get(code)
        expenseByAccount.set(code, { name, code, total: (existing?.total ?? 0) + net })
      }
    }
  }

  const topExpenseAccounts = [...expenseByAccount.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const topRevenueAccounts = [...revenueByAccount.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  // Outstanding receivables: sent/overdue invoices
  const receivablesAgg = await prisma.invoice.aggregate({
    where: {
      organizationId,
      status: { in: ["SENT", "OVERDUE"] },
    },
    _sum: { total: true },
    _count: { _all: true },
  })
  const totalReceivables = Number(receivablesAgg._sum.total ?? 0)

  // Outstanding payables: received/approved bills
  const payablesAgg = await prisma.bill.aggregate({
    where: {
      organizationId,
      status: { in: ["RECEIVED", "APPROVED", "PART_PAID", "OVERDUE"] },
      deletedAt: null,
    },
    _sum: { total: true },
    _count: { _all: true },
  })
  const totalPayables = Number(payablesAgg._sum.total ?? 0)

  // Overdue invoices
  const overdueInvoicesAgg = await prisma.invoice.aggregate({
    where: {
      organizationId,
      status: { in: ["SENT", "OVERDUE"] },
      dueDate: { lt: now },
    },
    _sum: { total: true },
    _count: { _all: true },
  })

  // Overdue bills
  const overdueBillsAgg = await prisma.bill.aggregate({
    where: {
      organizationId,
      status: { in: ["RECEIVED", "APPROVED", "PART_PAID", "OVERDUE"] },
      dueDate: { lt: now },
      deletedAt: null,
    },
    _sum: { total: true },
    _count: { _all: true },
  })

  return {
    organizationName: org.name,
    currency,
    periodStart: twelveMonthsAgo,
    periodEnd: now,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    totalReceivables,
    totalPayables,
    topExpenseAccounts,
    topRevenueAccounts,
    overdueInvoiceCount: overdueInvoicesAgg._count._all,
    overdueInvoiceTotal: Number(overdueInvoicesAgg._sum.total ?? 0),
    overdueBillCount: overdueBillsAgg._count._all,
    overdueBillTotal: Number(overdueBillsAgg._sum.total ?? 0),
    recentTransactionCount: txns.length,
  }
}

export function formatContextForPrompt(ctx: FinancialContext): string {
  const sym = ctx.currency === "GBP" ? "£" : ctx.currency
  const fmt = (n: number) =>
    `${sym}${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const period = `${ctx.periodStart.toLocaleDateString("en-GB", { month: "short", year: "numeric" })} – ${ctx.periodEnd.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`

  const lines = [
    `ORGANISATION FINANCIAL CONTEXT`,
    `Organisation: ${ctx.organizationName}`,
    `Reporting period: ${period} (12 months)`,
    `Currency: ${ctx.currency}`,
    ``,
    `── P&L SUMMARY ─────────────────────────`,
    `Revenue:        ${fmt(ctx.totalRevenue)}`,
    `Expenses:       ${fmt(ctx.totalExpenses)}`,
    `Net profit:     ${fmt(ctx.netProfit)}${ctx.netProfit < 0 ? " ⚠ LOSS" : ""}`,
    ``,
    `── OUTSTANDING BALANCES ─────────────────`,
    `Receivables:    ${fmt(ctx.totalReceivables)} (invoices awaiting payment)`,
    `Payables:       ${fmt(ctx.totalPayables)} (bills to be paid)`,
    `Overdue invoices: ${ctx.overdueInvoiceCount} totalling ${fmt(ctx.overdueInvoiceTotal)}`,
    `Overdue bills:    ${ctx.overdueBillCount} totalling ${fmt(ctx.overdueBillTotal)}`,
  ]

  if (ctx.topExpenseAccounts.length > 0) {
    lines.push(``, `── TOP EXPENSE ACCOUNTS ─────────────────`)
    ctx.topExpenseAccounts.forEach((a, i) => lines.push(`  ${i + 1}. ${a.name} (${a.code}): ${fmt(a.total)}`))
  }

  if (ctx.topRevenueAccounts.length > 0) {
    lines.push(``, `── TOP REVENUE ACCOUNTS ─────────────────`)
    ctx.topRevenueAccounts.forEach((a, i) => lines.push(`  ${i + 1}. ${a.name} (${a.code}): ${fmt(a.total)}`))
  }

  lines.push(``, `Total transactions in period: ${ctx.recentTransactionCount}`)
  return lines.join("\n")
}
