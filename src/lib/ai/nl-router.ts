/**
 * Natural-language → intent → real DB query → structured result
 *
 * Rather than letting OpenAI hallucinate financial figures, we:
 * 1. Classify the intent cheaply (gpt-4o-mini)
 * 2. Run the actual Prisma query for that intent
 * 3. Pass the real data back to OpenAI to write a narrative answer
 */

import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { resolveModels, getModelId, type ModelTier } from "./model-registry"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export type QueryIntent =
  | "OVERDUE_INVOICES"
  | "OUTSTANDING_RECEIVABLES"
  | "OUTSTANDING_PAYABLES"
  | "TOP_EXPENSES"
  | "REVENUE_SUMMARY"
  | "CASH_FLOW"
  | "VAT_LIABILITY"
  | "DUPLICATE_CHECK"
  | "GENERAL"

interface IntentClassification {
  intent: QueryIntent
  params: {
    dateFrom?: string
    dateTo?: string
    limit?: number
    accountName?: string
    customerName?: string
    vendorName?: string
  }
}

export interface NLQueryResult {
  intent: QueryIntent
  answer: string
  data: any
  suggestions: string[]
  modelUsed?: string
}

// ── Intent classification ─────────────────────────────────────────────────────

export async function classifyIntent(query: string, fastModel?: string): Promise<IntentClassification> {
  const today = new Date().toISOString().split("T")[0]
  const prompt = `Today is ${today}. Classify this accounting question into one intent.

QUERY: "${query}"

Return JSON only:
{
  "intent": "<one of: OVERDUE_INVOICES|OUTSTANDING_RECEIVABLES|OUTSTANDING_PAYABLES|TOP_EXPENSES|REVENUE_SUMMARY|CASH_FLOW|VAT_LIABILITY|DUPLICATE_CHECK|GENERAL>",
  "params": {
    "dateFrom": "<YYYY-MM-DD or null>",
    "dateTo": "<YYYY-MM-DD or null>",
    "limit": <number or null>,
    "accountName": "<string or null>",
    "customerName": "<string or null>",
    "vendorName": "<string or null>"
  }
}`

  try {
    const model = fastModel ?? getModelId("FAST")
    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 200,
    })
    return JSON.parse(res.choices[0]?.message?.content ?? "{}") as IntentClassification
  } catch {
    return { intent: "GENERAL", params: {} }
  }
}

// ── Data fetchers by intent ───────────────────────────────────────────────────

async function fetchOverdueInvoices(orgId: string, params: IntentClassification["params"]) {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["SENT", "OVERDUE"] },
      dueDate: { lt: new Date() },
      customer: params.customerName ? { name: { contains: params.customerName, mode: "insensitive" } } : undefined,
    },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: params.limit ?? 20,
  })
  const total = invoices.reduce((s, i) => s + Number(i.total), 0)
  return { invoices: invoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    customer: inv.customer.name,
    total: Number(inv.total),
    dueDate: inv.dueDate.toISOString().split("T")[0],
    daysOverdue: Math.floor((Date.now() - inv.dueDate.getTime()) / 86400000),
  })), total }
}

async function fetchOutstandingReceivables(orgId: string, params: IntentClassification["params"]) {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["SENT", "OVERDUE", "PART_PAID"] },
      customer: params.customerName ? { name: { contains: params.customerName, mode: "insensitive" } } : undefined,
    },
    include: { customer: { select: { name: true } } },
    orderBy: { total: "desc" },
  })
  // Group by customer
  const byCustomer = new Map<string, number>()
  for (const inv of invoices) {
    const name = inv.customer.name
    byCustomer.set(name, (byCustomer.get(name) ?? 0) + Number(inv.total))
  }
  const customers = [...byCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, params.limit ?? 10)
    .map(([customer, total]) => ({ customer, total }))
  const grandTotal = invoices.reduce((s, i) => s + Number(i.total), 0)
  return { customers, grandTotal, invoiceCount: invoices.length }
}

async function fetchOutstandingPayables(orgId: string, params: IntentClassification["params"]) {
  const bills = await prisma.bill.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["RECEIVED", "APPROVED", "PART_PAID", "OVERDUE"] },
      deletedAt: null,
      vendor: params.vendorName ? { name: { contains: params.vendorName, mode: "insensitive" } } : undefined,
    },
    include: { vendor: { select: { name: true } } },
    orderBy: { total: "desc" },
  })
  const byVendor = new Map<string, number>()
  for (const bill of bills) {
    const name = bill.vendor.name
    byVendor.set(name, (byVendor.get(name) ?? 0) + Number(bill.total))
  }
  const vendors = [...byVendor.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, params.limit ?? 10)
    .map(([vendor, total]) => ({ vendor, total }))
  const grandTotal = bills.reduce((s, b) => s + Number(b.total), 0)
  return { vendors, grandTotal, billCount: bills.length }
}

async function fetchTopExpenses(orgId: string, params: IntentClassification["params"]) {
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 3))
  const dateTo = params.dateTo ? new Date(params.dateTo) : new Date()
  const txns = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      date: { gte: dateFrom, lte: dateTo },
      account: { type: "EXPENSE" },
    },
    select: { debit: true, credit: true, account: { select: { name: true, code: true } } },
  })
  const byAccount = new Map<string, { name: string; total: number }>()
  for (const tx of txns) {
    const name = tx.account?.name ?? "Unknown"
    const net = Number(tx.debit) - Number(tx.credit)
    if (net > 0) byAccount.set(name, { name, total: (byAccount.get(name)?.total ?? 0) + net })
  }
  const accounts = [...byAccount.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, params.limit ?? 10)
  const grandTotal = accounts.reduce((s, a) => s + a.total, 0)
  return { accounts, grandTotal, period: { from: dateFrom.toISOString().split("T")[0], to: dateTo.toISOString().split("T")[0] } }
}

async function fetchRevenueSummary(orgId: string, params: IntentClassification["params"]) {
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 1))
  const dateTo = params.dateTo ? new Date(params.dateTo) : new Date()
  const txns = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      date: { gte: dateFrom, lte: dateTo },
      account: { type: "REVENUE" },
    },
    select: { debit: true, credit: true, account: { select: { name: true, code: true } } },
  })
  const byAccount = new Map<string, { name: string; total: number }>()
  for (const tx of txns) {
    const name = tx.account?.name ?? "Unknown"
    const net = Number(tx.credit) - Number(tx.debit)
    if (net > 0) byAccount.set(name, { name, total: (byAccount.get(name)?.total ?? 0) + net })
  }
  const accounts = [...byAccount.values()].sort((a, b) => b.total - a.total)
  const grandTotal = accounts.reduce((s, a) => s + a.total, 0)
  return { accounts, grandTotal, period: { from: dateFrom.toISOString().split("T")[0], to: dateTo.toISOString().split("T")[0] } }
}

async function fetchCashFlow(orgId: string, params: IntentClassification["params"]) {
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : new Date(new Date().setMonth(new Date().getMonth() - 3))
  const dateTo = params.dateTo ? new Date(params.dateTo) : new Date()
  const bankTxns = await prisma.bankTransaction.findMany({
    where: {
      organizationId: orgId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: { date: true, amount: true, description: true },
    orderBy: { date: "desc" },
    take: 50,
  })
  const totalIn = bankTxns.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0)
  const totalOut = bankTxns.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  return { totalIn, totalOut, net: totalIn - totalOut, transactions: bankTxns.length, period: { from: dateFrom.toISOString().split("T")[0], to: dateTo.toISOString().split("T")[0] } }
}

async function fetchVATLiability(orgId: string) {
  const submissions = await prisma.taxSubmission.findMany({
    where: { organizationId: orgId, taxType: "VAT" },
    orderBy: { periodEnd: "desc" },
    take: 4,
    select: { periodStart: true, periodEnd: true, status: true, metadata: true },
  })
  return { submissions: submissions.map(s => ({
    period: `${new Date(s.periodStart).toLocaleDateString("en-GB")} – ${new Date(s.periodEnd).toLocaleDateString("en-GB")}`,
    status: s.status,
    data: s.metadata,
  }))}
}

async function fetchDuplicateCheck(orgId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
  const txns = await prisma.transaction.findMany({
    where: { organizationId: orgId, date: { gte: thirtyDaysAgo } },
    select: { id: true, description: true, debit: true, credit: true, date: true },
    orderBy: { date: "desc" },
    take: 500,
  })
  const seen = new Map<string, typeof txns[0][]>()
  for (const tx of txns) {
    const key = `${tx.description}|${Number(tx.debit).toFixed(2)}|${Number(tx.credit).toFixed(2)}`
    const arr = seen.get(key) ?? []
    arr.push(tx)
    seen.set(key, arr)
  }
  const duplicates = [...seen.values()]
    .filter(arr => arr.length > 1)
    .map(arr => ({
      description: arr[0].description,
      amount: Number(arr[0].debit) || Number(arr[0].credit),
      occurrences: arr.length,
      dates: arr.map(t => t.date.toISOString().split("T")[0]),
    }))
  return { duplicates, checked: txns.length }
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function resolveNLQuery(
  query: string,
  organizationId: string,
  contextSummary: string,
  modelOverrides?: { fast?: string; smart?: string }
): Promise<NLQueryResult> {
  // Warm the model cache (no-op if already warm)
  await resolveModels(openai)

  const fastModel  = modelOverrides?.fast  ?? getModelId("FAST")
  const smartModel = modelOverrides?.smart ?? getModelId("SMART")

  const classification = await classifyIntent(query, fastModel)
  const { intent, params } = classification

  let rawData: any = {}

  switch (intent) {
    case "OVERDUE_INVOICES":
      rawData = await fetchOverdueInvoices(organizationId, params)
      break
    case "OUTSTANDING_RECEIVABLES":
      rawData = await fetchOutstandingReceivables(organizationId, params)
      break
    case "OUTSTANDING_PAYABLES":
      rawData = await fetchOutstandingPayables(organizationId, params)
      break
    case "TOP_EXPENSES":
      rawData = await fetchTopExpenses(organizationId, params)
      break
    case "REVENUE_SUMMARY":
      rawData = await fetchRevenueSummary(organizationId, params)
      break
    case "CASH_FLOW":
      rawData = await fetchCashFlow(organizationId, params)
      break
    case "VAT_LIABILITY":
      rawData = await fetchVATLiability(organizationId)
      break
    case "DUPLICATE_CHECK":
      rawData = await fetchDuplicateCheck(organizationId)
      break
    default:
      rawData = {}
  }

  // Synthesise a natural-language answer from real data
  const systemPrompt = `You are a financial assistant for Sumtise accounting software.
Answer based ONLY on the data provided — never invent figures.
Be concise and use the organisation's currency symbol.
Format amounts with commas. UK date format (DD/MM/YYYY).

${contextSummary}`

  const userPrompt = `User asked: "${query}"

Real data retrieved:
${JSON.stringify(rawData, null, 2)}

Write a clear, helpful answer in 2-4 sentences. If there is no data, say so honestly.`

  let answer = "I couldn't retrieve data at this time."
  try {
    const res = await openai.chat.completions.create({
      model: smartModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 350,
    })
    answer = res.choices[0]?.message?.content ?? answer
  } catch {
    // Fallback: format data directly
    answer = `Here is the data I found: ${JSON.stringify(rawData)}`
  }

  const suggestionMap: Record<QueryIntent, string[]> = {
    OVERDUE_INVOICES:         ["Which customers owe us the most?", "Show outstanding receivables", "Export aged receivables"],
    OUTSTANDING_RECEIVABLES:  ["Show overdue invoices", "What's our total revenue this month?"],
    OUTSTANDING_PAYABLES:     ["Which bills are overdue?", "Show cash flow"],
    TOP_EXPENSES:             ["Compare to last quarter", "Show revenue this period", "Find duplicate transactions"],
    REVENUE_SUMMARY:          ["What are our top expenses?", "Show net profit"],
    CASH_FLOW:                ["Show bank transactions", "What's our net profit?"],
    VAT_LIABILITY:            ["Show corporation tax submissions"],
    DUPLICATE_CHECK:          ["Show all transactions", "Find unusual transactions"],
    GENERAL:                  ["What are my overdue invoices?", "Show top expenses", "What's our cash position?"],
  }

  return {
    intent,
    answer,
    data: rawData,
    suggestions: suggestionMap[intent] ?? [],
    modelUsed: smartModel,
  }
}
