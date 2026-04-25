import OpenAI from "openai"
import { buildFinancialContext, formatContextForPrompt } from "./financial-context"
import { resolveNLQuery, type NLQueryResult } from "./nl-router"
import { scanReceipt, categorizeAgainstCOA, type ReceiptData, type CategorizedExpense } from "./receipt-ocr"
import { resolveModels, getModelId, type ModelSnapshot, type ModelTier } from "./model-registry"

export type { ModelSnapshot, ModelTier }

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export type { NLQueryResult, ReceiptData, CategorizedExpense }

export interface AIInsight {
  text: string
  type: "positive" | "warning" | "info"
}

// ── Model resolution ──────────────────────────────────────────────────────────

export async function getModelSnapshot(): Promise<ModelSnapshot> {
  return resolveModels(openai)
}

// ── Natural language query ────────────────────────────────────────────────────

export async function processQuery(
  query: string,
  organizationId: string,
  modelOverrides?: { fast?: string; smart?: string }
): Promise<NLQueryResult> {
  const ctx = await buildFinancialContext(organizationId)
  const contextSummary = formatContextForPrompt(ctx)
  return resolveNLQuery(query, organizationId, contextSummary, modelOverrides)
}

// ── Financial insights from real data ────────────────────────────────────────

export async function generateInsights(
  organizationId: string,
  period = "last 30 days",
  modelOverride?: string
): Promise<AIInsight[]> {
  const ctx = await buildFinancialContext(organizationId)
  const contextSummary = formatContextForPrompt(ctx)

  const model = modelOverride ?? getModelId("SMART")

  const prompt = `You are a financial advisor. Based ONLY on the real data below, generate 5 concise actionable insights.
Each insight must be grounded in the actual numbers. Do not invent data.

${contextSummary}

Return JSON array (exactly 5 items):
[
  { "text": "...", "type": "positive" | "warning" | "info" },
  ...
]`

  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 600,
    })
    const raw = JSON.parse(res.choices[0]?.message?.content ?? "{}") as any
    const items: AIInsight[] = Array.isArray(raw) ? raw : (raw.insights ?? raw.items ?? [])
    return items.slice(0, 5)
  } catch {
    // Fallback: derive rule-based insights from real context
    const insights: AIInsight[] = []
    const sym = ctx.currency === "GBP" ? "£" : ctx.currency
    const fmt = (n: number) => `${sym}${Math.abs(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`

    if (ctx.overdueInvoiceCount > 0) {
      insights.push({ text: `${ctx.overdueInvoiceCount} overdue invoice${ctx.overdueInvoiceCount > 1 ? "s" : ""} totalling ${fmt(ctx.overdueInvoiceTotal)} require immediate follow-up.`, type: "warning" })
    }
    if (ctx.netProfit < 0) {
      insights.push({ text: `Net loss of ${fmt(Math.abs(ctx.netProfit))} over the past 12 months — review top expense accounts.`, type: "warning" })
    } else {
      insights.push({ text: `Net profit of ${fmt(ctx.netProfit)} over the past 12 months.`, type: "positive" })
    }
    if (ctx.totalReceivables > ctx.totalPayables * 2) {
      insights.push({ text: `Strong receivables position: ${fmt(ctx.totalReceivables)} owed to you vs ${fmt(ctx.totalPayables)} payable.`, type: "positive" })
    }
    if (ctx.topExpenseAccounts[0]) {
      insights.push({ text: `Largest expense category: ${ctx.topExpenseAccounts[0].name} (${fmt(ctx.topExpenseAccounts[0].total)}).`, type: "info" })
    }
    insights.push({ text: `${ctx.recentTransactionCount} transactions recorded in the last 12 months.`, type: "info" })
    return insights.slice(0, 5)
  }
}

// ── Receipt OCR ───────────────────────────────────────────────────────────────

export async function extractReceiptData(
  imageBuffer: Buffer,
  mimeType = "image/jpeg",
  modelOverrides?: { fast?: string; vision?: string }
): Promise<ReceiptData> {
  return scanReceipt(imageBuffer, mimeType, modelOverrides)
}

// ── Expense categorization against real COA ──────────────────────────────────

export async function categorizeExpense(
  description: string,
  amount: number,
  merchantName: string | undefined,
  expenseAccounts: Array<{ id: string; name: string; code: string }>,
  modelOverride?: string
): Promise<CategorizedExpense> {
  return categorizeAgainstCOA(description, amount, merchantName, expenseAccounts, modelOverride)
}

// ── Anomaly detection ─────────────────────────────────────────────────────────

export interface Anomaly {
  type: "duplicate" | "unusual_amount" | "round_number"
  description: string
  severity: "low" | "medium" | "high"
  transactionId?: string
}

export function detectAnomalies(transactions: Array<{ id: string; description: string; debit: number; credit: number; date: string }>): Anomaly[] {
  const anomalies: Anomaly[] = []
  const amounts = transactions.map(t => Math.abs(t.debit + t.credit))
  const avg = amounts.reduce((s, a) => s + a, 0) / (amounts.length || 1)

  for (const tx of transactions) {
    const amt = Math.abs(tx.debit + tx.credit)

    // Unusually large
    if (amt > avg * 4 && amt > 1000) {
      anomalies.push({ type: "unusual_amount", description: `Unusually large: ${tx.description} (${amt.toFixed(2)})`, severity: "medium", transactionId: tx.id })
    }

    // Suspicious round number
    if (amt > 500 && amt % 1000 === 0) {
      anomalies.push({ type: "round_number", description: `Suspicious round amount: ${tx.description} (${amt.toFixed(2)})`, severity: "low", transactionId: tx.id })
    }
  }

  // Duplicates: same description + amount within any 7-day window
  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i], b = transactions[j]
      const daysDiff = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / 86400000
      if (
        a.description === b.description &&
        Math.abs(a.debit - b.debit) < 0.01 &&
        Math.abs(a.credit - b.credit) < 0.01 &&
        daysDiff <= 7
      ) {
        anomalies.push({ type: "duplicate", description: `Possible duplicate: "${a.description}" appears ${daysDiff.toFixed(0)} day(s) apart`, severity: "high", transactionId: a.id })
      }
    }
  }

  return anomalies
}
