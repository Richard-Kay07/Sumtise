/**
 * Agentic AI Accountant
 *
 * Uses OpenAI tool calling in a loop to:
 * 1. Understand what the user is asking
 * 2. Query real ledger data via tools before answering
 * 3. Propose journal entries as structured JSON (not free-text)
 * 4. Return a structured response the UI can render interactively
 *
 * The agent never writes to the database — all writes are explicit user actions
 * via the `postProposedEntry` tRPC mutation.
 */

import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { buildFinancialContext, formatContextForPrompt } from "./financial-context"
import { ACCOUNTANT_TOOLS, executeTool } from "./accountant-tools"
import { resolveModels, getModelId } from "./model-registry"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProposedJournalLine {
  accountCode: string
  accountName: string
  description: string
  debit: number
  credit: number
}

export interface ProposedEntry {
  reference: string
  description: string
  date: string            // ISO YYYY-MM-DD
  lines: ProposedJournalLine[]
  type: "journal" | "accrual" | "prepayment" | "deferred_revenue" | "reversal" | "correction"
  reversalDate?: string   // auto-reversal date (accruals / prepayments)
  notes: string           // accounting rationale
}

export interface ToolCallSummary {
  name: string
  summary: string         // human-readable summary of what was fetched
}

export interface AccountantResponse {
  answer: string
  proposedEntries: ProposedEntry[]
  toolCalls: ToolCallSummary[]
  modelUsed: string
}

export type ConversationMessage = {
  role: "user" | "assistant"
  content: string
}

// ── System prompt ─────────────────────────────────────────────────────────────

async function buildSystemPrompt(organizationId: string): Promise<string> {
  const ctx = await buildFinancialContext(organizationId)
  const ctxSummary = formatContextForPrompt(ctx)

  // Fetch COA summary for the prompt
  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId, isActive: true },
    select: { code: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    take: 100,
  })
  const coaLines = accounts.map(a => `  [${a.code}] ${a.name} (${a.type})`).join("\n")

  return `You are an expert UK accountant AI assistant embedded in Sumtise accounting software.
You have deep knowledge of FRS 102, FRS 105, IFRS, double-entry bookkeeping, UK VAT, and payroll.

ALWAYS follow this workflow:
1. Use your tools to fetch real data BEFORE answering any question about figures, balances, or entries.
2. Explain the accounting treatment and WHY in plain English.
3. When proposing a journal entry, output a [PROPOSED_ENTRY] block (see format below).
4. Reference the relevant accounting standard where helpful (e.g. "FRS 102 Section 21").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORGANISATION FINANCIAL SNAPSHOT
${ctxSummary}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHART OF ACCOUNTS (active accounts)
${coaLines}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CORE ACCOUNTING RULES YOU MUST FOLLOW:

DOUBLE-ENTRY: Every entry must have equal debits and credits (DR = CR).
  Asset / Expense accounts: increase with DEBIT, decrease with CREDIT
  Liability / Equity / Revenue accounts: increase with CREDIT, decrease with DEBIT

ACCRUALS (FRS 102 s.2, matching principle):
  Expense incurred but NOT yet invoiced:
    Period end:   DR [Expense account]  CR [Accruals - Current Liability]
    Next period:  DR [Accruals]          CR [Expense account]  ← auto-reversal

PREPAYMENTS (costs paid in advance):
  Payment:   DR [Prepayments - Current Asset]  CR [Bank/Cash]
  Each month: DR [Expense account]              CR [Prepayments]  ← amortise over period

RECEIPTS IN ADVANCE / DEFERRED REVENUE:
  Receipt:   DR [Bank/Cash]         CR [Deferred Revenue - Current Liability]
  When earned: DR [Deferred Revenue]  CR [Revenue account]

REVERSING ENTRIES (correcting errors):
  Date the reversal to the SAME accounting period as the original.
  For period-end accruals: date the reversal to the 1st of the NEXT period.

VAT (UK, standard rate 20%):
  On sales:     CR [VAT Output - Liability]   DR [Debtors / Bank]
  On purchases: DR [VAT Input - Asset]         CR [Creditors / Bank]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROPOSED ENTRY FORMAT — use EXACTLY this format when proposing a journal entry:

[PROPOSED_ENTRY]
{
  "reference": "JNL-001",
  "description": "Accrual for electricity Q1",
  "date": "2025-03-31",
  "type": "accrual",
  "reversalDate": "2025-04-01",
  "notes": "FRS 102 s.2 matching principle — electricity used in March but invoice not yet received.",
  "lines": [
    { "accountCode": "7200", "accountName": "Electricity", "description": "March electricity accrual", "debit": 1500, "credit": 0 },
    { "accountCode": "2109", "accountName": "Accruals", "description": "March electricity accrual", "debit": 0, "credit": 1500 }
  ]
}
[/PROPOSED_ENTRY]

- type must be one of: journal, accrual, prepayment, deferred_revenue, reversal, correction
- reversalDate should only be set for accrual/prepayment types
- All amounts in the organisation's base currency (${ctx.currency})
- accountCode must match an account from the chart of accounts above
- DR total must equal CR total exactly
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
}

// ── Proposed entry extraction ─────────────────────────────────────────────────

const ENTRY_REGEX = /\[PROPOSED_ENTRY\]([\s\S]*?)\[\/PROPOSED_ENTRY\]/g

export function extractProposedEntries(text: string): ProposedEntry[] {
  const entries: ProposedEntry[] = []
  let match: RegExpExecArray | null
  while ((match = ENTRY_REGEX.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as ProposedEntry
      if (parsed.lines && parsed.lines.length >= 2) {
        entries.push(parsed)
      }
    } catch {
      // Malformed JSON in proposed entry — skip
    }
  }
  ENTRY_REGEX.lastIndex = 0  // reset for reuse
  return entries
}

export function stripProposedEntries(text: string): string {
  return text.replace(/\[PROPOSED_ENTRY\][\s\S]*?\[\/PROPOSED_ENTRY\]/g, "").trim()
}

// ── Tool call summariser ──────────────────────────────────────────────────────

function summariseTool(name: string, args: any, result: any): string {
  switch (name) {
    case "get_journal_entries":
      return `Fetched ${result.count ?? 0} journal entries${args.dateFrom ? ` from ${args.dateFrom}` : ""}${args.dateTo ? ` to ${args.dateTo}` : ""}`
    case "get_account_balance":
      return `Account [${args.accountCode}] balance: ${result.balance != null ? `£${Number(result.balance).toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "not found"}`
    case "get_chart_of_accounts":
      return `Loaded ${result.total ?? 0} accounts${args.accountType ? ` (type: ${args.accountType})` : ""}`
    case "find_transaction_group":
      return result.error ? `No entries found for reference "${args.reference}"` : `Found ${result.lines?.length ?? 0} lines for reference "${args.reference}"`
    case "get_trial_balance_snapshot":
      return `Trial balance as of ${args.asOfDate ?? "today"} — ${result.rows?.length ?? 0} active accounts`
    default:
      return name
  }
}

// ── Main agent loop ───────────────────────────────────────────────────────────

export async function runAccountantAgent(
  conversation: ConversationMessage[],
  organizationId: string,
  modelOverride?: string
): Promise<AccountantResponse> {
  await resolveModels(openai)
  const model = modelOverride ?? getModelId("SMART")

  const systemPrompt = await buildSystemPrompt(organizationId)
  const toolCalls: ToolCallSummary[] = []

  // Build messages array — start fresh each call with full conversation history
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversation.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ]

  // Tool-use loop (max 6 turns to prevent runaway)
  for (let turn = 0; turn < 6; turn++) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools: ACCOUNTANT_TOOLS,
      tool_choice: "auto",
      temperature: 0.1,
      max_tokens: 2000,
    })

    const choice = response.choices[0]
    if (!choice) break

    if (choice.finish_reason === "stop" || !choice.message.tool_calls?.length) {
      // Final answer
      const rawAnswer = choice.message.content ?? ""
      const proposedEntries = extractProposedEntries(rawAnswer)
      const cleanAnswer = stripProposedEntries(rawAnswer)
      return { answer: cleanAnswer, proposedEntries, toolCalls, modelUsed: model }
    }

    // Execute each tool call
    messages.push(choice.message as OpenAI.Chat.ChatCompletionMessageParam)

    for (const tc of choice.message.tool_calls) {
      let args: Record<string, any> = {}
      try { args = JSON.parse(tc.function.arguments) } catch { /* ignore */ }

      const result = await executeTool(tc.function.name, args, organizationId)
      toolCalls.push({ name: tc.function.name, summary: summariseTool(tc.function.name, args, result) })

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
  }

  return {
    answer: "I wasn't able to complete the analysis. Please try rephrasing your question.",
    proposedEntries: [],
    toolCalls,
    modelUsed: model,
  }
}

// ── Account code → ID resolver (used by postProposedEntry) ───────────────────

export async function resolveAccountCode(
  code: string,
  organizationId: string
): Promise<string | null> {
  const account = await prisma.chartOfAccount.findFirst({
    where: { organizationId, code, isActive: true },
    select: { id: true },
  })
  if (account) return account.id

  // Fallback: search by name if not found by code
  const byName = await prisma.chartOfAccount.findFirst({
    where: {
      organizationId,
      isActive: true,
      name: { contains: code, mode: "insensitive" },
    },
    select: { id: true },
  })
  return byName?.id ?? null
}
