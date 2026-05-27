# Sumtise Architecture Audit Report
Generated: 2026-05-26
Auditor: Claude Code

---

## Summary Table

| Domain | Status | Priority |
|--------|--------|----------|
| Data Model | 🟡 Partial | P1 |
| Auth & Multi-Tenancy | 🟡 Partial | P1 |
| Core Ledger | 🟢 Ready | — |
| UK Tax / HMRC | 🟡 Partial | P1 |
| Agent Architecture | 🟡 Partial | P0 |
| AP/AR | 🟢 Ready | — |
| Reporting | 🟢 Ready | — |
| Infrastructure | 🟡 Partial | P1 |

---

## Domain Findings

### 1. Data Model
**Current state:**
The schema is large and well-structured (~2,600 lines). It contains: double-entry `Transaction` table, full Chart of Accounts with hierarchy, multi-currency FX, accounting periods (1–16 SAP-style), accrual/closing entries, approval workflows (`ManualJournal`, `ApprovalRequest`, `WorkflowPolicy`, `ApprovalAction`), bank import/reconciliation, payroll, fixed assets, inventory, budgets, leases (IFRS 16), grants, projects, tagging, WGA codes, and related parties.

**What is missing:**
- No `AgentAction` model — there is no table to persist agent runs, tool calls, decisions, token usage, or outcomes. This is the core structural gap for the Agentic OS positioning.
- The `Transaction` model is append-only in practice (no delete) but is not explicitly event-sourced. There is no `eventType`, `sourceDocumentType`, or `sourceDocumentId` on the transaction row — important for the agent layer to trace which agent created which posting.
- No `HmrcConnection` model — HMRC OAuth tokens (for live MTD submissions) cannot be persisted.
- No `VatPeriod` or `TaxPeriod` model separate from `TaxSubmission` — the current `TaxSubmission` table stores submissions but not the structured VAT period with obligation status from HMRC.
- No live bank feed model (TrueLayer/Open Banking token storage). The existing bank import is file-based CSV/OFX, not API-feed.
- `Organization` is a flat single-entity model. There is no parent-child `EntityGroup` or `ConsolidationGroup`. The `enableIntercompany` flag in `OrgModuleSettings` points to intent but is unimplemented.

**Gap:** AgentAction model, HmrcConnection model, VatPeriod model, BankFeedConnection model, multi-entity consolidation group.

**Priority:** P0 (AgentAction), P1 (HmrcConnection, VatPeriod, BankFeedConnection)

**Implementation instructions:** See IMPL-1 (AgentAction), IMPL-5 (HMRC models), IMPL-10 (bank feed)

---

### 2. Auth & Multi-Tenancy
**Current state:**
There is a split-identity problem. `src/middleware.ts` uses **Clerk** (`clerkMiddleware`). The tRPC context in `src/lib/trpc.ts` uses `auth()` and `verifyToken()` from `@clerk/nextjs/server`. The `@clerk/nextjs` package v6 is installed. However, `src/lib/auth.ts` implements a full **NextAuth.js** (credentials + Google OAuth) system using `PrismaAdapter`, and `src/app/api/auth/[...nextauth]/route.ts` exists. The `User`, `Account`, `Session`, and `VerificationToken` models in schema.prisma belong to NextAuth, not Clerk.

This is a significant inconsistency: Clerk is enforced at the middleware and tRPC context level, but NextAuth sign-up/sign-in pages and API routes are still present. In production, Clerk is the active identity provider; the NextAuth flow is dead code but introduces confusion and a potential shadow auth path.

Organization membership is verified on every tRPC call via `verifyOrganizationMembership()` inside the `orgScopedProcedure` middleware. RBAC is well-defined in `permissions.ts` with 5 roles and a full permission matrix. Permissions are checked via `requirePermissionProcedure()`.

**Gaps:**
- NextAuth remnants create a dead-code shadow auth path. The `auth/signin`, `auth/signup` pages and `/api/auth/[...nextauth]/route.ts` should be removed or explicitly disabled.
- Clerk org-level features (Clerk organizations) are not being used — the app manages its own org/membership tables. This is fine, but means Clerk org sync webhooks are absent. If users are deleted from Clerk, the local `OrganizationMember` rows are not cleaned up.
- No `AGENT` role exists for service-account-style agent actions that need their own permission scope.
- `WorkflowEntityType` enum only covers `MANUAL_JOURNAL`, `PAYMENT_RUN`, `EXPENSE_REPORT`. It needs `AGENT_ACTION` for the approval gateway.

**Priority:** P1

**Implementation instructions:** See IMPL-7

---

### 3. Core Ledger
**Current state:**
This is the strongest domain. The codebase has:
- `postDoubleEntry()` in `src/lib/posting.ts` — enforces DR=CR with a 1p tolerance, validates all account IDs belong to the org, wraps in a Prisma `$transaction`, stamps the open period ID, and records an audit log.
- `reversePosting()` — properly swaps DR/CR for reversals.
- Period lock enforcement — rejects postings into LOCKED or CLOSED periods.
- `ChartOfAccount` with account hierarchy (parentId), VAT treatment codes, normal balance, analysis codes (1–3), cost centre, department, fund, project, grant codes on the account itself.
- Accounting periods 1–16 with SAP-style adjustment periods.
- Accrual entries with auto-reversal period linkage.
- Closing entries (revenue/expense close to retained earnings).
- Bank reconciliation with `ReconciliationLine` linking `BankTransaction` to `Transaction`.
- COA templates (`src/lib/coa/templates.ts`) and seeding.
- Manual journal workflow with approval gate.
- Trial balance, P&L, balance sheet, cash flow, aged debtors/creditors, budget variance, and project profitability report pages all exist.

**Gaps:**
- The `Transaction` model does not carry `sourceDocumentType` / `sourceDocumentId` (e.g. `INVOICE`, `BILL`, `PAYROLL_RUN`). Traceability back to source documents requires searching `description` or `reference` fields.
- No running balance column on transactions (balance is computed from aggregates). For large orgs this creates query performance risk.
- No explicit inter-company elimination journal type.

**Priority:** These are P2 enhancements; the ledger is production-ready for Phase 1.

---

### 4. UK Tax / HMRC
**Current state:**
- `src/lib/tax/vat.ts` — complete VAT100 box calculation engine (standard, cash, flat rate schemes). All 9 boxes implemented. Quarter boundary helper present.
- `src/lib/tax/corporation-tax.ts` — marginal relief bands, capital allowances, R&D relief (SME + RDEC).
- `src/lib/tax/paye.ts` — PAYE/NI calculation engine exists.
- `src/server/routers/tax.ts` — VAT return query, CT estimate, RTI submissions stored in `TaxSubmission`.
- UI pages: `/tax/vat-mtd/`, `/tax/vat-non-mtd/`, `/tax/corporation-tax/`, payroll RTI submission page.
- `TaxSubmission` model records submissions with status, reference, data blob.

**Gaps — these are all genuine gaps:**
- No HMRC OAuth 2.0 integration. All submissions are recorded locally only (status set to `SUBMITTED` by the app). Nothing actually calls `https://api.service.hmrc.gov.uk/`. There is no `HmrcConnection` model for storing access/refresh tokens per org.
- No MTD VAT API client (`POST /organisations/vat/{vrn}/returns`, `GET /organisations/vat/{vrn}/obligations`). The MTD VAT page exists in the UI but it cannot submit to HMRC.
- No obligation polling — the app does not fetch outstanding VAT obligations from HMRC to pre-populate periods.
- No fraud prevention headers (required by HMRC MTD for all API calls).
- VAT scheme/registration number not stored per org (needs a field on `OrganizationSettings` or a new `VatRegistration` model).
- No MTD Income Tax Self-Assessment (ITSA) — out of scope for Phase 1 but should be noted.

**Priority:** P1

**Implementation instructions:** See IMPL-5, IMPL-6

---

### 5. Agent Architecture
**Current state:**
This is the most important gap given the Agentic OS positioning. What exists:
- `src/lib/ai/ai-service.ts` — OpenAI client (NOT Anthropic). Uses `openai` npm package with `OPENAI_API_KEY`.
- `src/lib/ai/accountant-agent.ts` — A tool-calling agent loop (max 6 turns). Uses OpenAI function calling. Has `ACCOUNTANT_TOOLS` (get journal entries, get account balance, get COA, find transaction group, get trial balance snapshot). Can propose journal entries as structured JSON that the UI renders. Calls `postDoubleEntry()` via the `postProposedEntry` tRPC mutation when the user confirms.
- `src/lib/ai/receipt-ocr.ts` — OCR for receipts.
- `src/lib/ai/nl-router.ts` — Natural language query routing.
- `src/lib/ai/financial-context.ts` — Context builder pulling real financial data.
- `src/lib/ai/model-registry.ts` — Model tier resolution (FAST/SMART/VISION/REASONING).
- Approval gateway: `ApprovalRequest`, `WorkflowPolicy`, `ApprovalAction` models fully built. Currently only covers `MANUAL_JOURNAL`.
- `src/server/routers/workflowPolicies.ts` — CRUD for workflow policies.
- `src/app/approvals/` — Approval UI pages.

**Critical gaps:**
- Uses **OpenAI**, not **Anthropic**. The strategy calls for Anthropic Claude. The model registry resolves against OpenAI model names. Package.json has `openai` but not `@anthropic-ai/sdk`.
- No `AgentAction` model — agent runs are entirely ephemeral. Nothing is persisted: which org triggered an agent, what tools were called, token usage, latency, cost, outcomes, or errors.
- No background job queue. All agent calls are synchronous HTTP requests inside tRPC mutations. For the 5-agent OS (Ledger, Tax, AP/AR, Payroll, FP&A) with autonomous scheduled runs, this is a structural blocker. There is a `REDIS_URL` env var referenced but no queue library (pg-boss, BullMQ, Inngest) is installed.
- Only 1 agent exists (Accountant/Ledger). Tax Agent, AP/AR Agent, Payroll Agent, FP&A Agent are not built.
- The approval gateway does not integrate with agent actions. Agents propose entries that go through the existing `postProposedEntry` mutation directly — there is no enforced approval step for high-value AI actions.
- No separate worker process. All jobs run inline with the web process.

**Priority:** P0

**Implementation instructions:** See IMPL-1 through IMPL-9

---

### 6. AP/AR
**Current state:**
This domain is comprehensive:
- `Invoice` (sales) with `InvoiceItem`, status lifecycle (DRAFT→SENT→PAID/OVERDUE/CANCELLED).
- `Bill` (purchase) with `BillItem`, line-level COA mapping, VAT rate per line, tracking codes (JSON).
- `CreditNote` / `DebitNote` with their own item lines.
- `BillAmendment` with approval workflow (separate from the new `ApprovalRequest` system — legacy implementation).
- `Payment` and `PaymentRun` (BACS/CHAPS/etc.).
- `RecurringInvoice` with frequency, auto-send, max runs.
- `InvoiceReminder` with scheduler (`src/lib/jobs/reminder-scheduler.ts`).
- `Vendor` with bank details (sort code, IBAN, SWIFT), default expense account, tax scheme.
- `Customer` with credit limit, payment terms, billing preferences.
- Aged receivables and aged payables report pages exist.
- Invoice PDF generation (`src/lib/pdf/invoice.ts`).

**Gaps:**
- `InvoiceItem` and `BillItem` have `taxRate` (decimal) but no `vatTreatmentCode` field. VAT treatment (STANDARD/REDUCED/ZERO/EXEMPT) is on the COA account, not the line item — when the account changes or the item is on a one-off account, the VAT treatment on the line is ambiguous.
- No explicit purchase-order (PO) model or PO-to-bill matching.
- `Payment` is linked to `Bill` but not to `Invoice` (only `Invoice.metadata.payments` is used). This makes payment matching for AR less rigorous than AP.
- No BACS file export format (though the model has the fields). The payment run has `fileReference` but no actual BACS file generation.

**Priority:** These are P2 items; AP/AR is production-ready for Phase 1.

---

### 7. Reporting
**Current state:**
Strong. The reports router covers:
- Trial Balance (with opening balance, period filtering)
- Cash Flow Statement
- Aged Receivables / Aged Payables
- P&L (Income Statement) — page exists
- Balance Sheet — page exists
- Budget Variance — page exists
- Project Profitability — page exists
- Forecasting — page + `src/server/routers/forecasts.ts`
- Transaction tagging breakdowns
- Analysis code breakdown

Recharts is used for visualisation. All report pages are present in `/src/app/reports/`.

**Gaps:**
- No consolidated (multi-entity) reporting. All reports are single-org scoped. The `enableIntercompany` flag exists but no consolidation logic does.
- No VAT return summary report linked directly to the reporting module (it lives in the tax router only).
- No XBRL/iXBRL export for Companies House filing.
- The `Report` model in the database stores report results as JSON blobs but this is not actively used by the report queries (they re-compute live). No saved report snapshots.

**Priority:** P2 items.

---

### 8. Infrastructure
**Current state:**
- `Dockerfile` — Node 20 Alpine, multi-stage build, standalone Next.js output. Production-grade.
- `railway.json` — Dockerfile builder, `sh start.sh` start command, restart on failure.
- `start.sh` — presumably runs migrations then starts the app (not read but conventional).
- `src/lib/prisma.ts` — Basic singleton PrismaClient, no connection pooling configuration (no `pgbouncer=true` in DATABASE_URL, no Prisma Accelerate).
- `src/lib/logger.ts` — Structured JSON logger with correlation IDs, user context, org context. Used throughout tRPC layer. Good.
- `REDIS_URL` is referenced in env vars but nothing in the codebase actually uses it (no Redis/queue client instantiated).
- No connection pool (PgBouncer/Prisma Accelerate) configured. Railway's PostgreSQL is direct-connection only unless explicitly configured.
- No separate worker process in `railway.json` — everything runs in the single web service.
- `docker-compose.yml` exists (likely for local dev with postgres).

**Gaps:**
- No pg-boss or equivalent for durable job queuing.
- No separate Railway worker service definition.
- No connection pooling — will hit PostgreSQL connection limits under load.
- `REDIS_URL` is referenced but unused — dead configuration.
- No health check endpoint that tests DB connectivity (the `/api/health` route exists but not read; likely basic).

**Priority:** P1

**Implementation instructions:** See IMPL-2, IMPL-9

---

## Key Finding: OpenAI vs Anthropic

The codebase uses `openai` npm package throughout the AI layer. The product roadmap calls for Anthropic Claude agents. This is not just a model swap — it requires replacing the OpenAI client with `@anthropic-ai/sdk`, adapting the tool-calling format (Anthropic uses `tools` array with `input_schema` not `function` objects), and updating the model registry. The agent loop in `accountant-agent.ts` will need to be rewritten for the Anthropic Messages API format. This is captured in IMPL-3.
