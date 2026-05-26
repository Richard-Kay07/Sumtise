import Anthropic from '@anthropic-ai/sdk'
import { BaseAgent } from './base-agent'
import { LEDGER_TOOLS, executeLedgerTool } from './tools/ledger-tools'
import { buildFinancialContext, formatContextForPrompt } from '@/lib/ai/financial-context'
import { prisma } from '@/lib/prisma'
import type { AgentContext } from './types'
import {
  extractProposedEntries,
  stripProposedEntries,
  type ProposedEntry,
  type ToolCallSummary,
  type AccountantResponse,
  type ConversationMessage,
} from '@/lib/ai/accountant-agent'

export class LedgerAgent extends BaseAgent {
  readonly agentType = 'LEDGER'
  readonly tools = LEDGER_TOOLS

  // systemPrompt is required by BaseAgent but built dynamically per org.
  // We set a placeholder and override in runChat().
  readonly systemPrompt = ''

  protected async executeToolCall(
    toolName: string,
    toolInput: Record<string, unknown>,
    ctx: AgentContext
  ): Promise<unknown> {
    return executeLedgerTool(toolName, toolInput as any, ctx.organizationId)
  }

  private async buildSystemPrompt(organizationId: string): Promise<string> {
    const financialCtx = await buildFinancialContext(organizationId)
    const ctxSummary = formatContextForPrompt(financialCtx)

    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId, isActive: true },
      select: { code: true, name: true, type: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      take: 100,
    })
    const coaLines = accounts.map(a => `  [${a.code}] ${a.name} (${a.type})`).join('\n')

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
  Period end:   DR [Expense account]  CR [Accruals - Current Liability]
  Next period:  DR [Accruals]          CR [Expense account]  ← auto-reversal

PREPAYMENTS (costs paid in advance):
  Payment:    DR [Prepayments - Current Asset]  CR [Bank/Cash]
  Each month: DR [Expense account]              CR [Prepayments]

RECEIPTS IN ADVANCE / DEFERRED REVENUE:
  Receipt:      DR [Bank/Cash]         CR [Deferred Revenue - Current Liability]
  When earned:  DR [Deferred Revenue]  CR [Revenue account]

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
- All amounts in the organisation's base currency (${financialCtx.currency})
- accountCode must match an account from the chart of accounts above
- DR total must equal CR total exactly
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  }

  async runChat(
    conversation: ConversationMessage[],
    ctx: AgentContext,
    maxTurns = 8
  ): Promise<AccountantResponse> {
    const systemPrompt = await this.buildSystemPrompt(ctx.organizationId)

    const toolCalls: ToolCallSummary[] = []
    const startedAt = new Date()

    const { getAnthropicClient } = await import('./client')
    const client = getAnthropicClient()

    const { prisma } = await import('@/lib/prisma')
    const action = await prisma.agentAction.create({
      data: {
        organizationId: ctx.organizationId,
        agentType: 'LEDGER',
        triggeredBy: ctx.triggeredBy,
        jobId: ctx.jobId,
        status: 'RUNNING',
        inputSummary: conversation[conversation.length - 1]?.content?.slice(0, 500) ?? '',
        startedAt,
      },
    })

    // Convert conversation history to Anthropic message format.
    // Anthropic requires alternating user/assistant turns.
    const messages: Anthropic.MessageParam[] = conversation.map(m => ({
      role: m.role,
      content: m.content,
    }))

    // The last message must be from the user; ensure this invariant.
    // (The caller is responsible for correct ordering, but guard anyway.)
    const lastRole = messages[messages.length - 1]?.role
    if (lastRole !== 'user') {
      messages.push({ role: 'user', content: 'Please continue.' })
    }

    let totalTokens = 0

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        const response = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          tools: this.tools,
          messages,
        })

        totalTokens += response.usage.input_tokens + response.usage.output_tokens

        if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
          const textBlock = response.content.find(b => b.type === 'text')
          const rawAnswer = textBlock?.type === 'text' ? textBlock.text : ''
          const proposedEntries = extractProposedEntries(rawAnswer)
          const cleanAnswer = stripProposedEntries(rawAnswer)

          await prisma.agentAction.update({
            where: { id: action.id },
            data: {
              status: 'COMPLETED',
              outputSummary: cleanAnswer.slice(0, 500),
              tokensUsed: totalTokens,
              toolCallCount: toolCalls.length,
              completedAt: new Date(),
              durationMs: Date.now() - startedAt.getTime(),
            },
          })

          return {
            answer: cleanAnswer,
            proposedEntries,
            toolCalls,
            modelUsed: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          }
        }

        // Handle tool use
        messages.push({ role: 'assistant', content: response.content })
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue

          const result = await this.executeToolCall(
            block.name,
            block.input as Record<string, unknown>,
            ctx
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
          toolCalls.push({
            name: block.name,
            summary: summariseTool(block.name, block.input as any, result),
          })
        }

        messages.push({ role: 'user', content: toolResults })
      }

      throw new Error('Max turns exceeded')
    } catch (err) {
      await prisma.agentAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          error: String(err),
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      })

      return {
        answer: "I wasn't able to complete the analysis. Please try rephrasing your question.",
        proposedEntries: [],
        toolCalls,
        modelUsed: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      }
    }
  }
}

function summariseTool(name: string, args: any, result: any): string {
  switch (name) {
    case 'get_journal_entries':
      return `Fetched ${result.count ?? 0} journal entries${args.dateFrom ? ` from ${args.dateFrom}` : ''}${args.dateTo ? ` to ${args.dateTo}` : ''}`
    case 'get_account_balance':
      return `Account [${args.accountCode}] balance: ${result.balance != null ? `£${Number(result.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : 'not found'}`
    case 'get_chart_of_accounts':
      return `Loaded ${result.total ?? 0} accounts${args.accountType ? ` (type: ${args.accountType})` : ''}`
    case 'find_transaction_group':
      return result.error ? `No entries found for reference "${args.reference}"` : `Found ${result.lines?.length ?? 0} lines for reference "${args.reference}"`
    case 'get_trial_balance_snapshot':
      return `Trial balance as of ${args.asOfDate ?? 'today'} — ${result.rows?.length ?? 0} active accounts`
    default:
      return name
  }
}
