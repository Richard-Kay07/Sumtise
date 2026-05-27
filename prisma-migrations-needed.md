# Prisma Migrations Needed — Agentic Accounting OS
Generated: 2026-05-26

All migrations are additive (no destructive changes to existing tables). Run each in order.

---

## Migration 001 — Agent Infrastructure

**Purpose:** Adds the `AgentAction` model and enums needed by all five agents. This is a P0 structural blocker — no agent can be built without it.

**Command:** `npx prisma migrate dev --name agent_infrastructure`

```prisma
// ─── Agent Infrastructure ─────────────────────────────────────────────────────

enum AgentType {
  LEDGER      // Transaction classification, journal proposals
  TAX         // VAT return compilation, CT estimation
  APAR        // AP/AR — debtor chasing, payment matching
  PAYROLL     // Gross-to-net, RTI, payroll journal
  FPNA        // Forecasting, variance analysis, scenario planning
}

enum AgentActionStatus {
  QUEUED      // Job accepted, not started
  RUNNING     // Agent is executing tool calls
  COMPLETED   // Final answer produced
  FAILED      // Unrecoverable error
  APPROVED    // Human approved the proposed action
  REJECTED    // Human rejected the proposed action
  CANCELLED   // Job cancelled before execution
}

model AgentAction {
  id             String            @id @default(cuid())
  organizationId String
  agentType      AgentType
  status         AgentActionStatus @default(QUEUED)

  // Trigger context
  triggeredBy    String            // userId or 'SCHEDULED' or 'WEBHOOK'
  jobId          String?           // pg-boss job ID (if async)

  // Input / output
  inputSummary   String?           @db.Text  // First 500 chars of the user prompt
  outputSummary  String?           @db.Text  // First 500 chars of the final answer
  proposedActions Json?            // Array of ProposedAction objects

  // Metrics
  tokensUsed     Int?
  toolCallCount  Int               @default(0)
  durationMs     Int?
  modelUsed      String?

  // Error tracking
  error          String?           @db.Text

  // Approval linkage — set when the action required human review
  approvalRequestId String?        @unique

  // Timestamps
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  organization    Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  approvalRequest ApprovalRequest? @relation(fields: [approvalRequestId], references: [id], onDelete: SetNull)

  @@index([organizationId, agentType])
  @@index([organizationId, status])
  @@index([organizationId, createdAt])
  @@index([jobId])
  @@map("agent_actions")
}
```

**Additions to existing models:**

Add to `Organization`:
```prisma
  agentActions AgentAction[]
```

Add to `ApprovalRequest`:
```prisma
  agentActionId  String?  @unique
  agentAction    AgentAction? @relation(fields: [agentActionId], references: [id], onDelete: SetNull)
```

Extend `WorkflowEntityType` enum (add new values):
```prisma
enum WorkflowEntityType {
  MANUAL_JOURNAL
  PAYMENT_RUN
  EXPENSE_REPORT
  AGENT_JOURNAL      // NEW: Agent-proposed double-entry journal
  VAT_RETURN         // NEW: Agent-compiled VAT return
  PAYROLL_RUN_AGENT  // NEW: Agent-processed payroll run
  BANK_FEED_SYNC     // NEW: Agent bank feed categorisation batch
}
```

Add `amountThreshold` to `WorkflowPolicy`:
```prisma
  amountThreshold Decimal? // If set, agent actions over this amount require approval
```

---

## Migration 002 — Event-Sourced Ledger Enhancements

**Purpose:** Adds `sourceDocumentType` and `sourceDocumentId` to `Transaction` for full document tracing. Also adds an `agentActionId` field to link a transaction group to the agent that proposed it.

**Command:** `npx prisma migrate dev --name ledger_source_tracing`

```prisma
// Additions to existing Transaction model:

model Transaction {
  // ... existing fields ...

  // Source document tracing (NEW)
  sourceDocumentType String?   // 'INVOICE' | 'BILL' | 'PAYROLL_RUN' | 'AGENT_ACTION' | 'MANUAL_JOURNAL' | 'BANK_FEED'
  sourceDocumentId   String?   // ID of the source document
  agentActionId      String?   // Link to the agent action that proposed this posting

  // ... existing relations ...
}
```

No new models — this is a pure field addition to `Transaction`. It will require:
```sql
ALTER TABLE transactions ADD COLUMN source_document_type TEXT;
ALTER TABLE transactions ADD COLUMN source_document_id TEXT;
ALTER TABLE transactions ADD COLUMN agent_action_id TEXT;
```

Prisma migration handles this automatically.

---

## Migration 003 — HMRC / Tax Models

**Purpose:** Adds `HmrcConnection` for storing HMRC OAuth tokens, and `VatPeriod` for tracking MTD VAT obligations with their live HMRC status.

**Command:** `npx prisma migrate dev --name hmrc_tax_models`

```prisma
// ─── HMRC Connection ─────────────────────────────────────────────────────────

enum HmrcConnectionStatus {
  ACTIVE
  EXPIRED
  REVOKED
  ERROR
}

model HmrcConnection {
  id             String                @id @default(cuid())
  organizationId String                @unique
  status         HmrcConnectionStatus  @default(ACTIVE)

  // HMRC VAT registration
  vatRegistrationNumber String?   // VRN — used in all MTD VAT API calls
  businessName           String?

  // OAuth tokens (store encrypted in production)
  accessToken    String   @db.Text
  refreshToken   String   @db.Text
  tokenType      String   @default("Bearer")
  scope          String?
  expiresAt      DateTime

  // Metadata
  connectedAt    DateTime @default(now())
  lastRefreshedAt DateTime?
  lastSyncAt     DateTime?
  metadata       Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vatPeriods   VatPeriod[]

  @@map("hmrc_connections")
}

// ─── VAT Period (MTD Obligation) ─────────────────────────────────────────────

enum VatPeriodStatus {
  OPEN        // HMRC obligation is open, return not yet filed
  FULFILLED   // Return submitted and accepted by HMRC
  OVERDUE     // Deadline passed, not yet filed
}

enum VatScheme {
  STANDARD
  CASH
  FLAT_RATE
  ANNUAL
}

model VatPeriod {
  id               String          @id @default(cuid())
  organizationId   String
  hmrcConnectionId String
  vrn              String          // VAT registration number

  // Period dates from HMRC obligation
  periodKey        String          // HMRC period key e.g. "23AA"
  periodStart      DateTime        @db.Date
  periodEnd        DateTime        @db.Date
  dueDate          DateTime        @db.Date
  status           VatPeriodStatus @default(OPEN)
  scheme           VatScheme       @default(STANDARD)

  // Calculated return data (populated by Tax Agent)
  box1OutputVat    Decimal?  @db.Decimal(19, 2)
  box2             Decimal?  @db.Decimal(19, 2)
  box3             Decimal?  @db.Decimal(19, 2)
  box4InputVat     Decimal?  @db.Decimal(19, 2)
  box5NetVat       Decimal?  @db.Decimal(19, 2)
  box6SalesNet     Decimal?  @db.Decimal(19, 2)
  box7PurchasesNet Decimal?  @db.Decimal(19, 2)
  box8             Decimal?  @db.Decimal(19, 2)
  box9             Decimal?  @db.Decimal(19, 2)

  // Submission tracking
  taxSubmissionId  String?   // Link to TaxSubmission once filed
  hmrcReceiptId    String?   // HMRC receipt reference from submission response
  submittedAt      DateTime?
  lastSyncedAt     DateTime?

  metadata         Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  hmrcConnection  HmrcConnection  @relation(fields: [hmrcConnectionId], references: [id], onDelete: Cascade)

  @@unique([organizationId, periodKey])
  @@index([organizationId, status])
  @@index([organizationId, dueDate])
  @@map("vat_periods")
}
```

**Additions to existing models:**

Add to `Organization`:
```prisma
  hmrcConnection HmrcConnection?
  vatPeriods     VatPeriod[]
```

---

## Migration 004 — Bank Feed Models

**Purpose:** Adds `BankFeedConnection` to store TrueLayer OAuth tokens per bank account, enabling live Open Banking feeds.

**Command:** `npx prisma migrate dev --name bank_feed_models`

```prisma
// ─── Bank Feed Connection (TrueLayer / Open Banking) ─────────────────────────

enum BankFeedProvider {
  TRUELAYER
  PLAID
  SALTEDGE
  MANUAL  // File import — existing path
}

enum BankFeedStatus {
  ACTIVE
  RECONNECT_REQUIRED
  EXPIRED
  REVOKED
  ERROR
}

model BankFeedConnection {
  id             String          @id @default(cuid())
  organizationId String
  bankAccountId  String          @unique
  provider       BankFeedProvider @default(TRUELAYER)
  status         BankFeedStatus  @default(ACTIVE)

  // Provider-specific credentials (store encrypted in production)
  accessToken    String   @db.Text
  refreshToken   String   @db.Text
  expiresAt      DateTime

  // Provider account identifiers
  providerAccountId  String?  // TrueLayer account ID
  providerBankId     String?  // TrueLayer institution ID
  bankDisplayName    String?

  // Sync state
  lastSyncedAt   DateTime?
  lastSuccessAt  DateTime?
  syncFromDate   DateTime?    // The earliest date to sync transactions from
  errorMessage   String?      @db.Text
  syncCount      Int          @default(0)  // Total successful syncs

  metadata       Json?
  connectedAt    DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  bankAccount  BankAccount  @relation(fields: [bankAccountId], references: [id], onDelete: Cascade)

  @@index([organizationId, status])
  @@index([organizationId, provider])
  @@map("bank_feed_connections")
}
```

**Additions to existing models:**

Add to `Organization`:
```prisma
  bankFeedConnections BankFeedConnection[]
```

Add to `BankAccount`:
```prisma
  feedConnection BankFeedConnection?
```

Add to `BankTransaction` (to distinguish feed transactions from imported ones):
```prisma
  sourceType  String?   // 'FEED' | 'IMPORT' | 'MANUAL'
  feedTxId    String?   // Provider transaction ID (for deduplication)
```

---

## Migration 005 — Multi-Entity Enhancements

**Purpose:** Adds the foundation for multi-entity consolidation. The `OrgModuleSettings.enableIntercompany` flag already exists — this migration adds the models it implies.

**Command:** `npx prisma migrate dev --name multi_entity`

**Note:** This is a P2 migration. Do not run in Phase 1.

```prisma
// ─── Entity Group (Consolidation) ────────────────────────────────────────────

enum ConsolidationMethod {
  FULL        // Full consolidation (subsidiary > 50% owned)
  EQUITY      // Equity method (associate 20-50% owned)
  PROPORTIONAL // Proportional consolidation (joint ventures)
}

model EntityGroup {
  id             String   @id @default(cuid())
  name           String
  description    String?  @db.Text
  baseCurrency   String   @default("GBP")
  reportingStandard String @default("FRS_102")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  members        EntityGroupMember[]

  @@map("entity_groups")
}

model EntityGroupMember {
  id             String                @id @default(cuid())
  entityGroupId  String
  organizationId String
  ownershipPercent Decimal?            @db.Decimal(5, 2)
  consolidationMethod ConsolidationMethod @default(FULL)
  isParent       Boolean              @default(false)
  joinedAt       DateTime             @default(now())

  entityGroup    EntityGroup          @relation(fields: [entityGroupId], references: [id], onDelete: Cascade)
  organization   Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([entityGroupId, organizationId])
  @@map("entity_group_members")
}

model IntercompanyTransaction {
  id              String   @id @default(cuid())
  entityGroupId   String
  fromOrgId       String
  toOrgId         String
  transactionDate DateTime
  amount          Decimal  @db.Decimal(19, 4)
  currency        String   @default("GBP")
  description     String
  eliminatedAt    DateTime?
  eliminatedBy    String?
  metadata        Json?
  createdAt       DateTime @default(now())

  entityGroup EntityGroup @relation(fields: [entityGroupId], references: [id], onDelete: Cascade)

  @@index([entityGroupId, transactionDate])
  @@map("intercompany_transactions")
}
```

**Additions to existing `Organization` model:**
```prisma
  entityGroupMemberships EntityGroupMember[]
```

**Note on `EntityGroup` relation to `EntityGroupMember`:** Also add `intercompanyTransactions IntercompanyTransaction[]` to `EntityGroup`.
