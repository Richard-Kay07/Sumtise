# Sumtise Implementation Plan — Agentic Accounting OS
Generated: 2026-05-26

All items ordered P0 → P1 → P2. Each IMPL block is self-contained and references exact files.

---

## P0 — Structural Blockers

---

### IMPL-1: Agent Action Log (Prisma Schema)
**Priority:** P0
**Domain:** Data Model / Agent Architecture
**Estimated effort:** S
**Depends on:** None

#### What to build
A durable `AgentAction` model that persists every agent invocation: which agent ran, which org triggered it, what tools were called, the outcome, token usage, latency, and whether it required or went through a human approval. This is the audit backbone of the entire Agentic OS.

#### Exact steps
1. Add the Prisma schema block (see `prisma-migrations-needed.md`, Migration 001).
2. Run `npx prisma migrate dev --name agent_infrastructure`.
3. Generate the Prisma client: `npx prisma generate`.
4. No application code changes needed at this step — IMPL-3 will consume the model.

#### Acceptance criteria
- [ ] `AgentAction` table exists in the database with all fields.
- [ ] `AgentActionStatus` and `AgentType` enums are created.
- [ ] `Organization` has a `agentActions AgentAction[]` relation.
- [ ] `prisma.agentAction.create()` can be called without error from a test script.

#### Files to create or modify
- `prisma/schema.prisma` — add `AgentAction` model and enums (see Migration 001)

---

### IMPL-2: pg-boss Queue Infrastructure
**Priority:** P0
**Domain:** Infrastructure / Agent Architecture
**Estimated effort:** M
**Depends on:** None (needs DATABASE_URL only)

#### What to build
Install `pg-boss` (PostgreSQL-native durable job queue — no separate Redis/queue infrastructure needed). Create a shared boss singleton, a queue initialiser, and typed job definitions for each of the 5 agents. pg-boss uses the same PostgreSQL database, so no new Railway service is required for Phase 1.

#### Exact steps
1. Install: `npm install pg-boss`.
2. Install types: `npm install --save-dev @types/pg-boss` (or check if included).
3. Create `src/lib/queue/boss.ts` — singleton pg-boss instance.
4. Create `src/lib/queue/jobs.ts` — typed job name constants and input/output schemas.
5. Create `src/lib/queue/worker.ts` — worker initialiser that registers all job handlers.
6. Create `scripts/worker.ts` — entry point for the separate worker process.
7. Add `"worker": "tsx scripts/worker.ts"` to `package.json` scripts.
8. Update Railway deployment (see IMPL-9) to run the worker as a separate service.

#### Code: `src/lib/queue/boss.ts`
```typescript
import PgBoss from 'pg-boss'

let _boss: PgBoss | null = null

export async function getBoss(): Promise<PgBoss> {
  if (!_boss) {
    _boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema: 'pgboss',
      monitorStateIntervalSeconds: 30,
      deleteAfterHours: 168, // keep completed jobs 7 days
    })
    await _boss.start()
  }
  return _boss
}

export async function stopBoss(): Promise<void> {
  if (_boss) {
    await _boss.stop()
    _boss = null
  }
}
```

#### Code: `src/lib/queue/jobs.ts`
```typescript
export const JOBS = {
  LEDGER_CLASSIFY:      'agent.ledger.classify',
  TAX_COMPILE_VAT:      'agent.tax.compile_vat',
  TAX_SUBMIT_HMRC:      'agent.tax.submit_hmrc',
  APAR_CHASE_DEBTORS:   'agent.apar.chase_debtors',
  APAR_MATCH_PAYMENTS:  'agent.apar.match_payments',
  PAYROLL_PROCESS:      'agent.payroll.process',
  FPNA_FORECAST:        'agent.fpna.forecast',
  FPNA_VARIANCE:        'agent.fpna.variance',
  BANK_FEED_SYNC:       'agent.bankfeed.sync',
} as const

export type JobName = typeof JOBS[keyof typeof JOBS]
```

#### Acceptance criteria
- [ ] `getBoss()` returns a started pg-boss instance connected to the same DATABASE_URL.
- [ ] `pgboss` schema tables are created in PostgreSQL after first run.
- [ ] A test job can be enqueued with `boss.send()` and dequeued with `boss.work()`.
- [ ] Worker process starts with `npm run worker` without error.

#### Files to create or modify
- `src/lib/queue/boss.ts` — new file
- `src/lib/queue/jobs.ts` — new file
- `src/lib/queue/worker.ts` — new file
- `scripts/worker.ts` — new file
- `package.json` — add `worker` script

---

### IMPL-3: Anthropic LLM Client + Base Agent Class
**Priority:** P0
**Domain:** Agent Architecture
**Estimated effort:** M
**Depends on:** IMPL-1

#### What to build
Replace the OpenAI client with Anthropic Claude. Create a base `BaseAgent` class that:
- Accepts a tool schema and a system prompt
- Runs the Anthropic tool-use loop (up to N turns)
- Persists every run to `AgentAction`
- Integrates with the approval gateway when actions exceed a threshold

Note: The existing `src/lib/ai/accountant-agent.ts` (OpenAI-based) can be kept as a legacy path temporarily while the new Anthropic agent is built alongside it. Do not delete it until IMPL-4 is validated.

#### Exact steps
1. Install: `npm install @anthropic-ai/sdk`.
2. Add `ANTHROPIC_API_KEY` to env (see `environment-variables-needed.md`).
3. Create `src/lib/agents/client.ts` — Anthropic client singleton.
4. Create `src/lib/agents/base-agent.ts` — `BaseAgent` abstract class.
5. Create `src/lib/agents/types.ts` — shared types for all agents.
6. Update `src/lib/ai/model-registry.ts` — add Anthropic model tiers alongside existing OpenAI tiers (or replace, depending on migration decision).

#### Code: `src/lib/agents/client.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  }
  return _client
}
```

#### Code: `src/lib/agents/types.ts`
```typescript
import type Anthropic from '@anthropic-ai/sdk'

export interface AgentRunResult {
  agentActionId: string
  answer: string
  toolCallCount: number
  tokensUsed: number
  requiresApproval: boolean
  proposedActions: ProposedAction[]
}

export interface ProposedAction {
  type: 'journal_entry' | 'payment' | 'tax_submission' | 'payroll_run'
  description: string
  data: Record<string, unknown>
  estimatedAmount?: number
}

export interface AgentContext {
  organizationId: string
  triggeredBy: string  // userId or 'SCHEDULED'
  jobId?: string       // pg-boss job ID if async
}
```

#### Code skeleton: `src/lib/agents/base-agent.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from './client'
import { prisma } from '@/lib/prisma'
import type { AgentRunResult, AgentContext, ProposedAction } from './types'

export abstract class BaseAgent {
  abstract readonly agentType: string
  abstract readonly systemPrompt: string
  abstract readonly tools: Anthropic.Tool[]

  protected abstract executeToolCall(
    toolName: string,
    toolInput: Record<string, unknown>,
    ctx: AgentContext
  ): Promise<unknown>

  async run(
    userMessage: string,
    ctx: AgentContext,
    maxTurns = 8
  ): Promise<AgentRunResult> {
    const startedAt = new Date()
    const client = getAnthropicClient()

    // Create AgentAction record
    const action = await prisma.agentAction.create({
      data: {
        organizationId: ctx.organizationId,
        agentType: this.agentType as any,
        triggeredBy: ctx.triggeredBy,
        jobId: ctx.jobId,
        status: 'RUNNING',
        inputSummary: userMessage.slice(0, 500),
        startedAt,
      },
    })

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage }
    ]

    let totalTokens = 0
    let toolCallCount = 0
    const proposedActions: ProposedAction[] = []

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        const response = await client.messages.create({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: this.systemPrompt,
          tools: this.tools,
          messages,
        })

        totalTokens += (response.usage.input_tokens + response.usage.output_tokens)

        if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
          const textBlock = response.content.find(b => b.type === 'text')
          const answer = textBlock?.type === 'text' ? textBlock.text : ''

          await prisma.agentAction.update({
            where: { id: action.id },
            data: {
              status: 'COMPLETED',
              outputSummary: answer.slice(0, 500),
              tokensUsed: totalTokens,
              toolCallCount,
              completedAt: new Date(),
              durationMs: Date.now() - startedAt.getTime(),
              proposedActions: proposedActions as any,
            },
          })

          return { agentActionId: action.id, answer, toolCallCount, tokensUsed: totalTokens, requiresApproval: false, proposedActions }
        }

        // Handle tool use
        messages.push({ role: 'assistant', content: response.content })
        const toolResults: Anthropic.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          toolCallCount++

          const result = await this.executeToolCall(block.name, block.input as Record<string, unknown>, ctx)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        }

        messages.push({ role: 'user', content: toolResults })
      }

      throw new Error('Max turns exceeded')
    } catch (err) {
      await prisma.agentAction.update({
        where: { id: action.id },
        data: { status: 'FAILED', error: String(err), completedAt: new Date(), durationMs: Date.now() - startedAt.getTime() },
      })
      throw err
    }
  }
}
```

#### Acceptance criteria
- [ ] `@anthropic-ai/sdk` installed, `ANTHROPIC_API_KEY` set.
- [ ] `BaseAgent.run()` creates an `AgentAction` row at start and updates it on completion.
- [ ] Failed agent runs persist error text.
- [ ] Token usage is recorded.

#### Files to create or modify
- `src/lib/agents/client.ts` — new file
- `src/lib/agents/types.ts` — new file
- `src/lib/agents/base-agent.ts` — new file
- `package.json` — add `@anthropic-ai/sdk`
- `src/lib/ai/model-registry.ts` — add Anthropic model constants

---

## P1 — Phase 1 Required

---

### IMPL-4: Ledger Agent (Transaction Classification)
**Priority:** P1
**Domain:** Agent Architecture / Core Ledger
**Estimated effort:** M
**Depends on:** IMPL-3, IMPL-2

#### What to build
The Ledger Agent replaces the existing OpenAI-based accountant agent for the core "classify and post" task. It extends `BaseAgent`, uses the existing `ACCOUNTANT_TOOLS` (adapted to Anthropic tool format), and is triggered both interactively (via tRPC mutation) and asynchronously (via pg-boss job for bulk classification).

The existing `runAccountantAgent()` in `src/lib/ai/accountant-agent.ts` does the right thing but must be ported to Anthropic and wired to persist `AgentAction`.

#### Exact steps
1. Create `src/lib/agents/ledger-agent.ts` extending `BaseAgent`.
2. Port `ACCOUNTANT_TOOLS` from `src/lib/ai/accountant-tools.ts` to Anthropic tool format (change `function.parameters` → `input_schema`).
3. Update `src/server/routers/ai.ts` — replace `runAccountantAgent()` calls with the new Ledger Agent.
4. Add a pg-boss job handler in `src/lib/queue/worker.ts` for `JOBS.LEDGER_CLASSIFY`.
5. Wire the `postProposedEntry` mutation to first create an `ApprovalRequest` if the journal amount exceeds the org's threshold (see IMPL-7).

#### Acceptance criteria
- [ ] `LedgerAgent.run()` produces a structured `ProposedEntry` with DR=CR.
- [ ] Every run creates an `AgentAction` row with tool call count and tokens used.
- [ ] The `accountantChat` tRPC mutation uses the new Ledger Agent.
- [ ] High-value entries (> threshold) route to the approval gateway instead of posting directly.

#### Files to create or modify
- `src/lib/agents/ledger-agent.ts` — new file
- `src/lib/agents/tools/ledger-tools.ts` — port of `accountant-tools.ts` to Anthropic format
- `src/server/routers/ai.ts` — update `accountantChat` and `postProposedEntry`
- `src/lib/queue/worker.ts` — add `JOBS.LEDGER_CLASSIFY` handler

---

### IMPL-5: HMRC MTD VAT API Integration
**Priority:** P1
**Domain:** UK Tax / HMRC
**Estimated effort:** L
**Depends on:** IMPL-1 (schema migration for HmrcConnection)

#### What to build
A real integration with the HMRC Making Tax Digital VAT API. Requires:
1. A new `HmrcConnection` Prisma model to store OAuth tokens per org (see Migration 003).
2. An HMRC OAuth 2.0 client (authorization code flow + token refresh).
3. An MTD VAT API client for: fetching obligations, retrieving returns, submitting returns.
4. Required fraud prevention headers on all HMRC API calls.
5. A new `vatPeriods` tRPC procedure that fetches live obligations from HMRC and syncs them to `TaxSubmission`.

#### Exact steps
1. Add `HmrcConnection`, `VatPeriod` models to schema (see Migration 003).
2. Run `npx prisma migrate dev --name hmrc_tax_models`.
3. Create `src/lib/hmrc/oauth.ts` — HMRC OAuth 2.0 client (handles code exchange, token storage, refresh).
4. Create `src/lib/hmrc/fraud-prevention.ts` — builds required fraud prevention headers from request context.
5. Create `src/lib/hmrc/mtd-vat.ts` — MTD VAT API client (get obligations, submit return).
6. Create `src/app/api/hmrc/callback/route.ts` — OAuth callback handler that stores tokens via `HmrcConnection`.
7. Update `src/server/routers/tax.ts` — add `connectHmrc`, `getVatObligations`, `submitMtdVatReturn` procedures.
8. Add `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`, `HMRC_BASE_URL`, `HMRC_REDIRECT_URI` to env.

#### Code: HMRC fraud prevention headers (mandatory)
```typescript
// src/lib/hmrc/fraud-prevention.ts
export function buildFraudPreventionHeaders(req: Request, userId: string): Record<string, string> {
  return {
    'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
    'Gov-Client-User-IDs': `sumtise=${userId}`,
    'Gov-Client-Timezone': 'UTC+00:00',
    'Gov-Client-Screens': '1280x720',
    'Gov-Client-Window-Size': '1280x720',
    'Gov-Client-Browser-JS-User-Agent': req.headers.get('user-agent') ?? '',
    'Gov-Client-Browser-Do-Not-Track': '1',
    'Gov-Vendor-Version': 'sumtise=1.0.0',
    'Gov-Vendor-License-IDs': '',
  }
}
```

#### HMRC API environments
- Sandbox: `https://test-api.service.hmrc.gov.uk`
- Production: `https://api.service.hmrc.gov.uk`

Set `HMRC_BASE_URL` per environment.

#### Acceptance criteria
- [ ] `HmrcConnection` and `VatPeriod` tables exist.
- [ ] OAuth connect flow stores access/refresh tokens encrypted in `HmrcConnection`.
- [ ] `getVatObligations` procedure fetches live obligations from HMRC sandbox.
- [ ] `submitMtdVatReturn` posts to `POST /organisations/vat/{vrn}/returns` and updates `TaxSubmission.status` to `ACCEPTED` or `REJECTED` based on HMRC response.
- [ ] All HMRC API calls include fraud prevention headers.
- [ ] Token refresh is handled automatically before expiry.

#### Files to create or modify
- `prisma/schema.prisma` — add `HmrcConnection`, `VatPeriod` (Migration 003)
- `src/lib/hmrc/oauth.ts` — new file
- `src/lib/hmrc/fraud-prevention.ts` — new file
- `src/lib/hmrc/mtd-vat.ts` — new file
- `src/app/api/hmrc/callback/route.ts` — new file
- `src/server/routers/tax.ts` — add HMRC procedures
- `src/app/tax/vat-mtd/page.tsx` — wire up live submission UI

---

### IMPL-6: Tax Agent (VAT Return Compilation)
**Priority:** P1
**Domain:** Agent Architecture / UK Tax
**Estimated effort:** M
**Depends on:** IMPL-3, IMPL-5

#### What to build
The Tax Agent autonomously compiles a VAT return for a given period by:
1. Fetching open VAT obligations from HMRC (or from the local `VatPeriod` table).
2. Running the `aggregateVATReturn()` function from `src/lib/tax/vat.ts` on the ledger data.
3. Identifying anomalies (large unusual transactions, missing VAT treatment on accounts).
4. Producing a structured VAT return proposal that requires human review before submission (mandatory human-in-the-loop for tax submissions).

This agent NEVER submits to HMRC directly — it always produces an `ApprovalRequest` which a human must approve before `submitMtdVatReturn` is called.

#### Exact steps
1. Create `src/lib/agents/tax-agent.ts` extending `BaseAgent`.
2. Create `src/lib/agents/tools/tax-tools.ts` — tools: `get_vat_transactions`, `get_vat_obligations`, `get_vat_return_calculation`.
3. Add `JOBS.TAX_COMPILE_VAT` handler to `src/lib/queue/worker.ts`.
4. On completion, create an `ApprovalRequest` with `entityType: 'VAT_RETURN'` (requires extending the enum — see IMPL-7).
5. Add tRPC procedure `ai.runTaxAgent` that enqueues the job and returns the `agentActionId`.

#### Acceptance criteria
- [ ] Tax Agent produces a structured VAT100 proposal with box values.
- [ ] Agent flags transactions without a VAT treatment code.
- [ ] The output is always an `ApprovalRequest` — never auto-submitted.
- [ ] Every run is persisted as an `AgentAction` with `agentType: 'TAX'`.

#### Files to create or modify
- `src/lib/agents/tax-agent.ts` — new file
- `src/lib/agents/tools/tax-tools.ts` — new file
- `src/lib/queue/worker.ts` — add `TAX_COMPILE_VAT` handler
- `src/server/routers/ai.ts` — add `runTaxAgent` procedure
- `prisma/schema.prisma` — extend `WorkflowEntityType` enum with `VAT_RETURN`, `PAYROLL_RUN_AGENT`, `BANK_FEED_SYNC`

---

### IMPL-7: Human Approval Gateway — Extend for Agent Actions
**Priority:** P1
**Domain:** Agent Architecture / Auth
**Estimated effort:** M
**Depends on:** IMPL-1, IMPL-3

#### What to build
The approval gateway (`ApprovalRequest`, `WorkflowPolicy`, `ApprovalAction`) is already built for `MANUAL_JOURNAL`. It must be extended to cover agent-initiated actions. The key additions:
1. Extend `WorkflowEntityType` enum with: `VAT_RETURN`, `PAYROLL_RUN_AGENT`, `BANK_FEED_SYNC`, `AGENT_JOURNAL`.
2. Add `agentActionId` foreign key to `ApprovalRequest` so the approval can reference the originating agent run.
3. Create a high-value threshold policy in `WorkflowPolicy` — any agent-proposed journal over a configurable amount requires approval.
4. Add a `submitForApproval()` helper in `src/lib/agents/base-agent.ts` that the agent calls instead of posting directly.
5. Update the approvals UI (`src/app/approvals/`) to display agent-authored proposals with the agent's rationale.

#### Exact steps
1. Add new enum values to `WorkflowEntityType` in `prisma/schema.prisma`.
2. Add `agentActionId String? @unique` to `ApprovalRequest`.
3. Run `npx prisma migrate dev --name extend_approval_gateway`.
4. Create `src/lib/agents/approval-gateway.ts` — `submitAgentActionForApproval()` helper.
5. Update `src/server/routers/workflowPolicies.ts` — accept new entity types.
6. Update `src/app/approvals/[id]/page.tsx` — display agent rationale when `agentActionId` is present.
7. Add `approveAgentAction` tRPC procedure that, upon approval, executes the pending action (e.g. posts the journal or submits to HMRC).

#### Acceptance criteria
- [ ] An agent-proposed journal creates an `ApprovalRequest` with `entityType: 'AGENT_JOURNAL'` and `agentActionId` linked.
- [ ] The approvals list page shows agent-initiated approvals with the agent type badge.
- [ ] Approving an agent journal calls `postDoubleEntry()` and marks `AgentAction.status = 'APPROVED'`.
- [ ] Rejecting an agent action marks both `ApprovalRequest.status = 'REJECTED'` and `AgentAction.status = 'REJECTED'`.
- [ ] `WorkflowPolicy` can be configured per entity type with an `amountThreshold` field (add this field to the model).

#### Files to create or modify
- `prisma/schema.prisma` — extend `WorkflowEntityType`, add `agentActionId` to `ApprovalRequest`, add `amountThreshold` to `WorkflowPolicy`
- `src/lib/agents/approval-gateway.ts` — new file
- `src/server/routers/workflowPolicies.ts` — update for new entity types
- `src/server/routers/ai.ts` — wire approval gateway into agent posting path
- `src/app/approvals/[id]/page.tsx` — display agent metadata

---

### IMPL-8: FP&A Agent (Forecasting + Variance Analysis)
**Priority:** P1
**Domain:** Agent Architecture / Reporting
**Estimated effort:** L
**Depends on:** IMPL-3, IMPL-2

#### What to build
The FP&A Agent uses the existing `forecasts` router and `Budget`/`BudgetLine` data to:
1. Generate a 12-month rolling cash flow forecast using linear regression on historical transactions.
2. Produce a budget vs actual variance analysis with explanations.
3. Flag accounts where actuals are trending more than 15% above budget.
4. Output a structured narrative report (markdown) that can be shown in the UI.

The existing `src/server/routers/forecasts.ts` contains forecasting logic — the agent wraps this with LLM interpretation.

#### Exact steps
1. Create `src/lib/agents/fpna-agent.ts` extending `BaseAgent`.
2. Create `src/lib/agents/tools/fpna-tools.ts` — tools: `get_budget_vs_actual`, `get_historical_cashflow`, `get_forecast_data`, `get_period_comparison`.
3. Add `JOBS.FPNA_FORECAST` and `JOBS.FPNA_VARIANCE` handlers to `src/lib/queue/worker.ts`.
4. Add tRPC procedures `ai.runFpnaForecast` and `ai.runVarianceAnalysis`.
5. Wire results to `src/app/reports/forecasting/page.tsx` and `src/app/reports/budget-variance/page.tsx`.

#### Acceptance criteria
- [ ] FP&A Agent produces a 12-month cash flow forecast with confidence intervals.
- [ ] Variance analysis identifies top 5 accounts by adverse variance and explains each.
- [ ] Results are stored as `AgentAction.outputSummary` and retrievable via tRPC.
- [ ] Agent runs are schedulable via pg-boss (monthly trigger).

#### Files to create or modify
- `src/lib/agents/fpna-agent.ts` — new file
- `src/lib/agents/tools/fpna-tools.ts` — new file
- `src/lib/queue/worker.ts` — add FP&A handlers
- `src/server/routers/ai.ts` — add FP&A procedures

---

### IMPL-9: Separate Railway Worker Process
**Priority:** P1
**Domain:** Infrastructure
**Estimated effort:** S
**Depends on:** IMPL-2

#### What to build
Configure Railway to run a second service (the worker) from the same Docker image. The worker runs `scripts/worker.ts` which starts pg-boss and registers all job handlers. This isolates long-running agent jobs from the web process and enables horizontal scaling.

#### Exact steps
1. Create `railway.json` with two services: `web` and `worker`.
2. The worker service uses `startCommand: "tsx scripts/worker.ts"`.
3. Both services share the same `DATABASE_URL` environment variable.
4. Add graceful shutdown handling to `scripts/worker.ts` (SIGTERM → `boss.stop()`).
5. Add health monitoring: the worker emits a heartbeat log every 60 seconds.

#### Updated `railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "services": {
    "web": {
      "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
      "deploy": {
        "startCommand": "sh start.sh",
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
      }
    },
    "worker": {
      "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
      "deploy": {
        "startCommand": "node --import tsx/esm scripts/worker.ts",
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 5
      }
    }
  }
}
```

Note: Railway's multi-service config uses `railway.toml` or separate service configs in the Railway dashboard. The `railway.json` above is illustrative — configure via the Railway dashboard by creating a new service from the same repo with the override start command.

#### Acceptance criteria
- [ ] Worker process starts independently of the web process.
- [ ] Worker registers all pg-boss job handlers on startup.
- [ ] Worker shuts down gracefully on SIGTERM without dropping in-flight jobs.
- [ ] Worker health is visible in Railway logs with a periodic heartbeat.
- [ ] Web process does not process any agent jobs — it only enqueues them.

#### Files to create or modify
- `scripts/worker.ts` — new file (entry point)
- `railway.json` — update or create worker service (via Railway dashboard)
- `src/lib/queue/worker.ts` — job handler registrations

---

### IMPL-10: Bank Feed Ingestion (TrueLayer)
**Priority:** P1
**Domain:** Data Model / AP/AR
**Estimated effort:** L
**Depends on:** IMPL-2 (queue for async sync)

#### What to build
Add live bank feed integration via TrueLayer (UK Open Banking aggregator). This replaces the file-based CSV/OFX import as the primary bank data source. TrueLayer connects to 99%+ of UK banks via Open Banking.

The existing `BankTransaction`, `BankAccount`, and `BankStatementImport` models are sufficient for storing feed data. What is missing is:
1. A `BankFeedConnection` model to store TrueLayer access/refresh tokens per bank account.
2. TrueLayer OAuth flow.
3. A pg-boss job to periodically sync new transactions.
4. Auto-categorisation of feed transactions using the Ledger Agent.

#### Exact steps
1. Add `BankFeedConnection` model to schema (see Migration 004).
2. Run `npx prisma migrate dev --name bank_feed_models`.
3. Create `src/lib/bank-feed/truelayer.ts` — TrueLayer API client (OAuth, transactions, accounts).
4. Create `src/app/api/truelayer/callback/route.ts` — OAuth callback.
5. Add tRPC procedures: `bankAccounts.connectFeed`, `bankAccounts.syncFeed`, `bankAccounts.disconnectFeed`.
6. Add `JOBS.BANK_FEED_SYNC` handler to the worker — runs every 4 hours per connected bank account.
7. After syncing, enqueue `JOBS.LEDGER_CLASSIFY` to auto-categorise new transactions.

#### Acceptance criteria
- [ ] TrueLayer OAuth connect flow stores tokens in `BankFeedConnection`.
- [ ] Sync job fetches new transactions since `lastSyncedAt` and writes them to `BankTransaction`.
- [ ] Duplicate detection uses `BankStatementImport.fileHash` approach (hash of transaction reference + date + amount).
- [ ] Token refresh is handled automatically.
- [ ] Auto-categorisation queues a Ledger Agent job for uncategorised transactions.

#### Files to create or modify
- `prisma/schema.prisma` — add `BankFeedConnection` (Migration 004)
- `src/lib/bank-feed/truelayer.ts` — new file
- `src/app/api/truelayer/callback/route.ts` — new file
- `src/server/routers/bankAccounts.ts` — add feed procedures
- `src/lib/queue/worker.ts` — add `BANK_FEED_SYNC` handler

---

## P2 — Phase 2

---

### IMPL-11: Multi-Entity Consolidation
**Priority:** P2
**Domain:** Data Model / Reporting
**Estimated effort:** XL
**Depends on:** None (additive)

#### What to build
Add an `EntityGroup` model that groups multiple `Organization` records. Consolidation reports aggregate transactions across the group with inter-company eliminations. The `enableIntercompany` flag in `OrgModuleSettings` is the feature gate.

#### Files to create or modify
- `prisma/schema.prisma` — add `EntityGroup`, `EntityGroupMember`, `IntercompanyTransaction`
- `src/server/routers/reports.ts` — add consolidated P&L, consolidated balance sheet
- New pages under `src/app/reports/consolidated/`

---

### IMPL-12: AP/AR Agent (Debtor Chasing + Payment Matching)
**Priority:** P2
**Domain:** Agent Architecture / AP/AR
**Estimated effort:** M
**Depends on:** IMPL-3, IMPL-4

#### What to build
The AP/AR Agent:
1. Scans overdue invoices and drafts personalised chase emails (using existing email infrastructure).
2. Matches bank feed credits to open invoices using fuzzy matching on amount + reference.
3. Flags disputed invoices based on partial payments or response emails.

Uses existing `InvoiceReminder` model and `src/lib/reconciliation/matching.ts`.

#### Files to create or modify
- `src/lib/agents/apar-agent.ts` — new file
- `src/lib/agents/tools/apar-tools.ts` — new file
- `src/lib/queue/worker.ts` — add `APAR_CHASE_DEBTORS`, `APAR_MATCH_PAYMENTS` handlers

---

### IMPL-13: Payroll Agent (Gross-to-Net + RTI)
**Priority:** P2
**Domain:** Agent Architecture / Payroll
**Estimated effort:** L
**Depends on:** IMPL-3, IMPL-7

#### What to build
The Payroll Agent:
1. Reads employee records and computes gross-to-net using `src/lib/payroll/index.ts` and `src/lib/tax/paye.ts`.
2. Validates the payroll run totals.
3. Generates the payroll journal via `src/lib/payroll/coaPosting.ts`.
4. Produces an RTI `Full Payment Submission` file (XML) for manual upload to HMRC (automated RTI submission is a separate integration).
5. Always requires approval via the gateway before posting.

#### Files to create or modify
- `src/lib/agents/payroll-agent.ts` — new file
- `src/lib/agents/tools/payroll-tools.ts` — new file
- `src/lib/queue/worker.ts` — add `PAYROLL_PROCESS` handler

---

### IMPL-14: Source Document Tracing on Transactions
**Priority:** P2
**Domain:** Data Model / Core Ledger
**Estimated effort:** S
**Depends on:** None

#### What to build
Add `sourceDocumentType` and `sourceDocumentId` fields to the `Transaction` model so every ledger posting can be traced back to its originating document (invoice, bill, payroll run, agent action, etc.).

#### Files to create or modify
- `prisma/schema.prisma` — add `sourceDocumentType String?`, `sourceDocumentId String?` to `Transaction`
- `src/lib/posting.ts` — pass source document info through `PostDoubleEntryOptions`

---

### IMPL-15: Companies House Integration
**Priority:** P2
**Domain:** Infrastructure
**Estimated effort:** S
**Depends on:** None

#### What to build
Fetch company details from Companies House API to auto-populate org settings (registered name, address, SIC codes, filing dates). Store Companies House number on `Organization`.

#### Files to create or modify
- `prisma/schema.prisma` — add `companiesHouseNumber String?` to `Organization`
- `src/lib/companies-house/client.ts` — new file
- `src/server/routers/settings.ts` — add `lookupCompaniesHouse` procedure
