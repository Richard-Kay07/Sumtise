/**
 * Accountant Agent — Tool Definitions + Executors
 *
 * These tools are exposed to the OpenAI model via function calling.
 * Each tool reads from Prisma but never writes — all writes go through
 * the explicit `postProposedEntry` mutation so the user stays in control.
 */

import { prisma } from "@/lib/prisma"
import type OpenAI from "openai"

// ── Tool definitions (passed to OpenAI) ──────────────────────────────────────

export const ACCOUNTANT_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_journal_entries",
      description: "Fetch recent journal entries (ledger transactions) optionally filtered by date range, account code, or reference. Returns grouped entries showing all lines of each posting together.",
      parameters: {
        type: "object",
        properties: {
          dateFrom:    { type: "string", description: "Start date YYYY-MM-DD" },
          dateTo:      { type: "string", description: "End date YYYY-MM-DD" },
          accountCode: { type: "string", description: "Filter to a specific account code" },
          reference:   { type: "string", description: "Filter by reference or description (partial match)" },
          limit:       { type: "number", description: "Max results (default 20, max 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Get the current balance of one or more accounts, optionally as of a specific date. Useful for checking if an accruals or prepayment account has a balance before creating entries.",
      parameters: {
        type: "object",
        required: ["accountCode"],
        properties: {
          accountCode: { type: "string", description: "Account code (e.g. 2100, 1200)" },
          asOfDate:    { type: "string", description: "Balance as of this date YYYY-MM-DD (default: today)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chart_of_accounts",
      description: "Fetch the organisation's chart of accounts. Use this before proposing journal entries to find the correct account codes and verify account types.",
      parameters: {
        type: "object",
        properties: {
          accountType: {
            type: "string",
            enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
            description: "Filter by account type",
          },
          search: { type: "string", description: "Search account name or code" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_transaction_group",
      description: "Find all lines of a journal entry by its reference code. Use this before reversing or correcting a transaction to see the full original posting.",
      parameters: {
        type: "object",
        required: ["reference"],
        properties: {
          reference: { type: "string", description: "The transaction reference or document reference to find" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_trial_balance_snapshot",
      description: "Get a summary trial balance showing all accounts with non-zero balances. Useful for understanding the current state of the ledger.",
      parameters: {
        type: "object",
        properties: {
          asOfDate: { type: "string", description: "Balance as of YYYY-MM-DD (default: today)" },
        },
      },
    },
  },
]

// ── Tool executors ────────────────────────────────────────────────────────────

export type ToolName = typeof ACCOUNTANT_TOOLS[number]["function"]["name"]

export async function executeTool(
  name: string,
  args: Record<string, any>,
  organizationId: string
): Promise<any> {
  switch (name) {
    case "get_journal_entries":       return getJournalEntries(args, organizationId)
    case "get_account_balance":       return getAccountBalance(args, organizationId)
    case "get_chart_of_accounts":     return getChartOfAccounts(args, organizationId)
    case "find_transaction_group":    return findTransactionGroup(args, organizationId)
    case "get_trial_balance_snapshot":return getTrialBalanceSnapshot(args, organizationId)
    default: return { error: `Unknown tool: ${name}` }
  }
}

// ── Individual executors ──────────────────────────────────────────────────────

async function getJournalEntries(args: any, orgId: string) {
  const limit = Math.min(args.limit ?? 20, 50)
  const where: any = { organizationId: orgId }
  if (args.dateFrom) where.date = { ...where.date, gte: new Date(args.dateFrom) }
  if (args.dateTo)   where.date = { ...where.date, lte: new Date(args.dateTo) }
  if (args.accountCode) {
    const acct = await prisma.chartOfAccount.findFirst({ where: { organizationId: orgId, code: args.accountCode } })
    if (acct) where.accountId = acct.id
  }
  if (args.reference) {
    where.OR = [
      { reference: { contains: args.reference, mode: "insensitive" } },
      { description: { contains: args.reference, mode: "insensitive" } },
    ]
  }

  const txns = await prisma.transaction.findMany({
    where,
    include: { account: { select: { code: true, name: true, type: true } } },
    orderBy: { date: "desc" },
    take: limit,
  })

  // Group by reference so related DR/CR lines appear together
  const grouped = new Map<string, typeof txns>()
  for (const tx of txns) {
    const key = tx.reference ?? `no-ref-${tx.date.toISOString().split("T")[0]}-${tx.description}`
    const group = grouped.get(key) ?? []
    group.push(tx)
    grouped.set(key, group)
  }

  return {
    count: txns.length,
    entries: [...grouped.entries()].map(([ref, lines]) => ({
      reference: ref.startsWith("no-ref-") ? null : ref,
      date: lines[0].date.toISOString().split("T")[0],
      description: lines[0].description,
      lines: lines.map(l => ({
        account: `[${l.account.code}] ${l.account.name}`,
        accountType: l.account.type,
        debit:  Number(l.debit),
        credit: Number(l.credit),
      })),
      totalDebit:  lines.reduce((s, l) => s + Number(l.debit), 0),
      totalCredit: lines.reduce((s, l) => s + Number(l.credit), 0),
    })),
  }
}

async function getAccountBalance(args: any, orgId: string) {
  const asOf = args.asOfDate ? new Date(args.asOfDate) : new Date()
  const account = await prisma.chartOfAccount.findFirst({
    where: { organizationId: orgId, code: args.accountCode, isActive: true },
    select: { id: true, name: true, code: true, type: true, openingBalance: true },
  })
  if (!account) return { error: `Account with code ${args.accountCode} not found` }

  const txns = await prisma.transaction.aggregate({
    where: { organizationId: orgId, accountId: account.id, date: { lte: asOf } },
    _sum: { debit: true, credit: true },
  })
  const debits  = Number(txns._sum.debit  ?? 0)
  const credits = Number(txns._sum.credit ?? 0)
  const opening = Number(account.openingBalance ?? 0)

  const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE"
  const balance = isDebitNormal
    ? opening + debits - credits
    : opening + credits - debits

  return {
    code: account.code,
    name: account.name,
    type: account.type,
    debitTotal:  debits,
    creditTotal: credits,
    balance,
    normalBalance: isDebitNormal ? "DEBIT" : "CREDIT",
    asOf: asOf.toISOString().split("T")[0],
  }
}

async function getChartOfAccounts(args: any, orgId: string) {
  const where: any = { organizationId: orgId, isActive: true }
  if (args.accountType) where.type = args.accountType
  if (args.search) {
    where.OR = [
      { name: { contains: args.search, mode: "insensitive" } },
      { code: { contains: args.search, mode: "insensitive" } },
    ]
  }

  const accounts = await prisma.chartOfAccount.findMany({
    where,
    select: { code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    take: 80,
  })

  const grouped: Record<string, Array<{ code: string; name: string }>> = {}
  for (const a of accounts) {
    if (!grouped[a.type]) grouped[a.type] = []
    grouped[a.type].push({ code: a.code, name: a.name })
  }
  return { total: accounts.length, byType: grouped }
}

async function findTransactionGroup(args: any, orgId: string) {
  const txns = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      reference: { contains: args.reference, mode: "insensitive" },
    },
    include: { account: { select: { code: true, name: true, type: true } } },
    orderBy: { date: "asc" },
    take: 20,
  })

  if (txns.length === 0) return { error: `No transactions found with reference matching "${args.reference}"` }

  return {
    reference: args.reference,
    date: txns[0].date.toISOString().split("T")[0],
    description: txns[0].description,
    transactionIds: txns.map(t => t.id),
    lines: txns.map(t => ({
      id: t.id,
      account: `[${t.account.code}] ${t.account.name}`,
      accountCode: t.account.code,
      accountType: t.account.type,
      debit:  Number(t.debit),
      credit: Number(t.credit),
    })),
    totalDebit:  txns.reduce((s, t) => s + Number(t.debit), 0),
    totalCredit: txns.reduce((s, t) => s + Number(t.credit), 0),
  }
}

async function getTrialBalanceSnapshot(args: any, orgId: string) {
  const asOf = args.asOfDate ? new Date(args.asOfDate) : new Date()

  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, code: true, name: true, type: true, openingBalance: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  })

  const txnTotals = await prisma.transaction.groupBy({
    by: ["accountId"],
    where: { organizationId: orgId, date: { lte: asOf } },
    _sum: { debit: true, credit: true },
  })

  const totalsMap = new Map(txnTotals.map(t => [t.accountId, t]))

  const rows = accounts
    .map(a => {
      const t = totalsMap.get(a.id)
      const debits  = Number(t?._sum.debit  ?? 0)
      const credits = Number(t?._sum.credit ?? 0)
      const opening = Number(a.openingBalance ?? 0)
      const isDebitNormal = a.type === "ASSET" || a.type === "EXPENSE"
      const balance = isDebitNormal ? opening + debits - credits : opening + credits - debits
      return { code: a.code, name: a.name, type: a.type, balance }
    })
    .filter(r => Math.abs(r.balance) > 0.005)

  const totals = rows.reduce(
    (s, r) => {
      if (r.type === "ASSET" || r.type === "EXPENSE") s.debits += r.balance > 0 ? r.balance : 0
      else s.credits += r.balance > 0 ? r.balance : 0
      return s
    },
    { debits: 0, credits: 0 }
  )

  return { asOf: asOf.toISOString().split("T")[0], rows, ...totals }
}
