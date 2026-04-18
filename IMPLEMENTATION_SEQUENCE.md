# Sumtise Implementation Sequence Plan

**Date:** January 2024  
**Version:** 1.0  
**Purpose:** Optimal sequence for implementing missing features

---

## Implementation Philosophy

This sequence prioritizes:
1. **Foundation First** - Core infrastructure before advanced features
2. **Dependencies** - Build prerequisites before dependent features
3. **User Value** - Deliver working features quickly
4. **Risk Mitigation** - Address critical gaps early
5. **Incremental Delivery** - Each phase delivers usable functionality

---

## PHASE 1: CRITICAL BACKEND FOUNDATION (Weeks 1-4)

**Goal:** Enable core accounting operations to function end-to-end

### Week 1: Bills & Vendors Foundation

#### 1.1 Implement Vendors Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** None  
**Effort:** 1-2 days  
**Blocks:** Bills, Payment Runs, Expenses

**Tasks:**
- [ ] Create `src/server/routers/vendors.ts`
- [ ] Implement `vendors.getAll` (with pagination, search, filters)
- [ ] Implement `vendors.getById` (with bills, payments)
- [ ] Implement `vendors.create` (with validation)
- [ ] Implement `vendors.update` (with org guard)
- [ ] Implement `vendors.delete` (soft delete)
- [ ] Add to `appRouter` in `src/server/routers/app.ts`
- [ ] Test with Postman/Playwright

**Why First:** Bills require vendors. This is a prerequisite for all expense management.

---

#### 1.2 Implement Bills Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** Vendors Router (#1.1)  
**Effort:** 2-3 days  
**Blocks:** Payment Runs, Expenses Module, Bill Amendments

**Tasks:**
- [ ] Create `src/server/routers/bills.ts`
- [ ] Implement `bills.getAll` (with status filters, vendor filters, date range)
- [ ] Implement `bills.getById` (with items, amendments, payments)
- [ ] Implement `bills.create` (with items, account assignment)
- [ ] Implement `bills.update` (with org guard)
- [ ] Implement `bills.delete` (soft delete/cancel)
- [ ] Implement `bills.getOutstandingForPayment` (for payment runs)
- [ ] Implement `bills.approve` (workflow)
- [ ] Implement `bills.markAsPaid` (status update)
- [ ] Add to `appRouter`
- [ ] Connect frontend `/expenses/page.tsx` to backend
- [ ] Connect frontend `/expenses/new/page.tsx` to backend

**Why Second:** Core expense management. Required for payment runs and amendments.

---

### Week 2: Payment Processing Foundation

#### 2.1 Implement Payments Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** Bills Router (#1.2)  
**Effort:** 1-2 days  
**Blocks:** Payment Runs, Invoice Payment Recording

**Tasks:**
- [ ] Create `src/server/routers/payments.ts`
- [ ] Implement `payments.getAll` (with filters: vendor, bill, date range)
- [ ] Implement `payments.getById` (with bill, vendor, payment run)
- [ ] Implement `payments.create` (individual payment)
- [ ] Implement `payments.reverse` (with audit trail)
- [ ] Implement `payments.getHistory` (for vendor/bill)
- [ ] Add accounting transaction creation (double-entry)
- [ ] Add to `appRouter`
- [ ] Test payment creation creates correct transactions

**Why Third:** Payment tracking is needed before batch processing.

---

#### 2.2 Implement Payment Runs Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** Bills Router (#1.2), Payments Router (#2.1)  
**Effort:** 2-3 days  
**Blocks:** Supplier Payment Workflow

**Tasks:**
- [ ] Create `src/server/routers/paymentRuns.ts`
- [ ] Implement `paymentRuns.getAll` (with status filters)
- [ ] Implement `paymentRuns.getById` (with payments, bills)
- [ ] Implement `paymentRuns.getOutstandingBills` (bills ready for payment)
- [ ] Implement `paymentRuns.create` (create run with multiple payments)
- [ ] Implement `paymentRuns.process` (update status, create payments)
- [ ] Implement `paymentRuns.exportFile` (BACS/CSV generation)
- [ ] Add accounting transaction creation for all payments
- [ ] Update bill statuses to PAID
- [ ] Add to `appRouter`
- [ ] Connect frontend `/expenses/payment-run/page.tsx` to backend
- [ ] Test end-to-end payment run workflow

**Why Fourth:** Completes the expense payment workflow. High user value.

---

### Week 3: Invoice Enhancements

#### 3.1 Implement Credit Notes Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** Invoices Router (exists)  
**Effort:** 1-2 days  
**Blocks:** Credit Note Workflow

**Tasks:**
- [ ] Create `src/server/routers/creditNotes.ts`
- [ ] Implement `creditNotes.create` (from invoice, with items)
- [ ] Implement `creditNotes.getAll` (with filters)
- [ ] Implement `creditNotes.getById` (with invoice, items)
- [ ] Implement `creditNotes.apply` (apply to invoice balance)
- [ ] Implement `creditNotes.cancel` (status update)
- [ ] Add accounting transaction creation
- [ ] Update invoice balance on credit note creation
- [ ] Add to `appRouter`
- [ ] Connect frontend `/invoices/credit-note/page.tsx` to backend

**Why Fifth:** Essential for invoice management. Relatively straightforward.

---

#### 3.2 Implement Invoice Reminders Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** Invoices Router (exists)  
**Effort:** 1-2 days  
**Blocks:** Automated Reminder System

**Tasks:**
- [ ] Create `src/server/routers/invoiceReminders.ts`
- [ ] Implement `invoiceReminders.create` (schedule reminder)
- [ ] Implement `invoiceReminders.getAll` (with filters)
- [ ] Implement `invoiceReminders.getOutstandingInvoices` (for reminders)
- [ ] Implement `invoiceReminders.sendReminder` (single)
- [ ] Implement `invoiceReminders.sendBulkReminders` (multiple)
- [ ] Implement `invoiceReminders.getTemplates` (email templates)
- [ ] Add to `appRouter`
- [ ] Connect frontend `/invoices/reminders/page.tsx` to backend
- [ ] Note: Email sending will be added in Phase 2

**Why Sixth:** High user value. Can work without email initially (queue reminders).

---

#### 3.3 Enhance Invoices Router ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Invoices Router (exists)  
**Effort:** 1 day  
**Blocks:** Invoice Payment Workflow

**Tasks:**
- [ ] Add `invoices.getOutstanding` (for reminders, reports)
- [ ] Add `invoices.recordPayment` (link payment to invoice)
- [ ] Add `invoices.markAsPaid` (update status)
- [ ] Add `invoices.getPayments` (payment history)
- [ ] Add `invoices.duplicate` (clone invoice)
- [ ] Update invoice status based on payments
- [ ] Test invoice payment workflow

**Why Seventh:** Completes invoice lifecycle. Needed for aged receivables.

---

### Week 4: Debit Notes & Amendments

#### 4.1 Implement Debit Notes Router ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** Bills Router (#1.2), Vendors Router (#1.1)  
**Effort:** 1-2 days  
**Blocks:** Expense Credit Workflow

**Tasks:**
- [ ] Create `src/server/routers/debitNotes.ts`
- [ ] Implement `debitNotes.create` (from bill or standalone)
- [ ] Implement `debitNotes.getAll` (with filters)
- [ ] Implement `debitNotes.getById` (with bill, vendor, items)
- [ ] Implement `debitNotes.apply` (apply to bill balance)
- [ ] Implement `debitNotes.cancel` (status update)
- [ ] Add accounting transaction creation
- [ ] Update bill balance on debit note creation
- [ ] Add to `appRouter`
- [ ] Connect frontend `/expenses/debit-note/page.tsx` to backend

**Why Eighth:** Completes expense credit workflow. Mirrors credit notes.

---

#### 4.2 Implement Bill Amendments Router ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Bills Router (#1.2)  
**Effort:** 2 days  
**Blocks:** Audit Trail for Expenses

**Tasks:**
- [ ] Create `src/server/routers/billAmendments.ts`
- [ ] Implement `billAmendments.create` (with original/amended data)
- [ ] Implement `billAmendments.getAll` (with filters)
- [ ] Implement `billAmendments.getById` (with bill, user, approver)
- [ ] Implement `billAmendments.getHistory` (for specific bill)
- [ ] Implement `billAmendments.approve` (update bill, create audit log)
- [ ] Implement `billAmendments.reject` (status update)
- [ ] Add to `appRouter`
- [ ] Connect frontend `/expenses/amend/page.tsx` to backend
- [ ] Test approval workflow

**Why Ninth:** Important for audit compliance. Can be built after core CRUD.

---

**Phase 1 Deliverables:**
- ✅ Complete expense management (bills, vendors, payments)
- ✅ Complete invoice enhancements (credit notes, reminders)
- ✅ Payment run functionality
- ✅ Audit trail for amendments
- ✅ All core accounting workflows functional

---

## PHASE 2: INTEGRATIONS & FILE HANDLING (Weeks 5-7)

**Goal:** Enable external integrations and file operations

### Week 5: File Storage & PDF Generation

#### 5.1 Implement File Storage Integration ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** None  
**Effort:** 2-3 days  
**Blocks:** Receipt Storage, PDF Generation

**Tasks:**
- [ ] Choose file storage (AWS S3, Google Cloud Storage, or local)
- [ ] Install storage SDK
- [ ] Create `src/lib/storage.ts` utility
- [ ] Implement file upload function
- [ ] Implement file retrieval function
- [ ] Implement file deletion function
- [ ] Update `/api/files/route.ts` to use storage
- [ ] Add file upload to expense creation
- [ ] Add file attachment to invoices
- [ ] Test file upload/download

**Why First in Phase 2:** Required for receipts and PDFs. Foundation for other features.

---

#### 5.2 Implement PDF Export ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** File Storage (#5.1)  
**Effort:** 2-3 days  
**Blocks:** Invoice PDFs, Report PDFs

**Tasks:**
- [ ] Choose PDF library (PDFKit, jsPDF, Puppeteer, or React-PDF)
- [ ] Create `src/lib/pdf/invoice.ts` (invoice PDF generator)
- [ ] Create `src/lib/pdf/report.ts` (report PDF generator)
- [ ] Implement invoice PDF template
- [ ] Implement report PDF templates
- [ ] Add `invoices.exportPDF` endpoint
- [ ] Add `reports.exportPDF` endpoint
- [ ] Update frontend export buttons
- [ ] Test PDF generation and download

**Why Second:** High user value. Invoices need PDFs for sending.

---

### Week 6: Email Integration

#### 6.1 Implement Email Service Integration ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** PDF Export (#5.2)  
**Effort:** 2-3 days  
**Blocks:** Invoice Emails, Reminder Emails

**Tasks:**
- [ ] Choose email service (SendGrid, AWS SES, Mailgun)
- [ ] Install email SDK
- [ ] Create `src/lib/email/client.ts`
- [ ] Create email templates (invoice, reminder, payment confirmation)
- [ ] Implement `sendInvoiceEmail` function
- [ ] Implement `sendReminderEmail` function
- [ ] Implement `sendPaymentConfirmation` function
- [ ] Add email sending to invoice creation/send
- [ ] Add email sending to reminder system
- [ ] Update `/api/email/route.ts` (if exists)
- [ ] Test email delivery

**Why Third:** Critical for invoice workflow. Users expect email functionality.

---

#### 6.2 Complete Invoice Reminders Email Integration ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Email Service (#6.1), Invoice Reminders Router (#3.2)  
**Effort:** 1 day  
**Blocks:** Automated Reminder System

**Tasks:**
- [ ] Connect reminder router to email service
- [ ] Implement reminder queue processing
- [ ] Add scheduled reminder execution (cron job or queue)
- [ ] Update reminder status after email send
- [ ] Add email delivery tracking
- [ ] Test automated reminder system

**Why Fourth:** Completes the reminder system started in Phase 1.

---

### Week 7: Banking Integration Foundation

#### 7.1 Enhance Bank Accounts Router ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Bank Accounts Router (exists)  
**Effort:** 2 days  
**Blocks:** Bank Reconciliation

**Tasks:**
- [ ] Add `bankAccounts.reconcile` (mark transactions as reconciled)
- [ ] Add `bankAccounts.getTransactions` (transactions for account)
- [ ] Add `bankAccounts.getUnreconciled` (unreconciled transactions)
- [ ] Add `bankAccounts.updateBalance` (manual balance update)
- [ ] Add transaction matching logic
- [ ] Connect to `/banking/page.tsx` frontend
- [ ] Test reconciliation workflow

**Why Fifth:** Enables manual bank reconciliation. Foundation for automation.

---

#### 7.2 Implement Bank Statement Import ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** File Storage (#5.1), Bank Accounts Router (#7.1)  
**Effort:** 2-3 days  
**Blocks:** Automated Reconciliation

**Tasks:**
- [ ] Create CSV/OFX parser
- [ ] Create `bankAccounts.importStatement` endpoint
- [ ] Implement statement parsing
- [ ] Implement transaction creation from statement
- [ ] Add duplicate detection
- [ ] Add import UI to `/banking/page.tsx`
- [ ] Test import with sample statements

**Why Sixth:** Enables manual import. Can be done before Open Banking.

---

**Phase 2 Deliverables:**
- ✅ File storage operational
- ✅ PDF generation for invoices and reports
- ✅ Email sending for invoices and reminders
- ✅ Bank reconciliation functionality
- ✅ Bank statement import

---

## PHASE 3: MISSING FRONTEND PAGES (Weeks 8-10)

**Goal:** Complete user-facing interfaces for existing backend

### Week 8: Customers & Transactions Modules

#### 8.1 Implement Customers Module Pages ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Customers Router (exists)  
**Effort:** 2-3 days  
**Blocks:** Customer Management UI

**Tasks:**
- [ ] Create `/customers/page.tsx` (listing with search, filters)
- [ ] Create `/customers/new/page.tsx` (create customer form)
- [ ] Create `/customers/[id]/page.tsx` (customer details)
- [ ] Create `/customers/[id]/invoices/page.tsx` (customer invoices)
- [ ] Add customer selection to invoice creation
- [ ] Add navigation links
- [ ] Test customer CRUD workflow

**Why First:** Backend exists, just needs UI. High user value.

---

#### 8.2 Implement Transactions Module Pages ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Transactions Router (exists, needs enhancement)  
**Effort:** 2-3 days  
**Blocks:** Transaction Management UI

**Tasks:**
- [ ] Enhance transactions router (add missing endpoints from audit)
- [ ] Create `/transactions/page.tsx` (listing with filters)
- [ ] Create `/transactions/new/page.tsx` (create transaction)
- [ ] Create `/transactions/journal/page.tsx` (journal entries)
- [ ] Create `/transactions/[id]/page.tsx` (details)
- [ ] Add navigation links
- [ ] Test transaction CRUD workflow

**Why Second:** Core accounting feature. Users need to see/manage transactions.

---

### Week 9: Reports Module Completion

#### 9.1 Implement Missing Report Pages ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** Reports Router (exists), Transactions Router  
**Effort:** 3-4 days  
**Blocks:** Complete Reporting Suite

**Tasks:**
- [ ] Create `/reports/trial-balance/page.tsx` (Trial Balance)
- [ ] Create `/reports/cashflow/page.tsx` (Cash Flow Statement)
- [ ] Create `/reports/aged-receivables/page.tsx` (Aged Receivables)
- [ ] Create `/reports/aged-payables/page.tsx` (Aged Payables)
- [ ] Create `/reports/budget-variance/page.tsx` (Budget Variance - placeholder)
- [ ] Create `/reports/cost-analysis/page.tsx` (Cost Analysis - placeholder)
- [ ] Add report calculation logic
- [ ] Add date range filters
- [ ] Add export functionality
- [ ] Test all reports

**Why Third:** Completes reporting suite. High user value.

---

### Week 10: Settings Pages

#### 10.1 Implement Settings Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Settings API (exists)  
**Effort:** 2-3 days  
**Blocks:** User Configuration UI

**Tasks:**
- [ ] Create `/settings/organisation/page.tsx` (organisation settings)
- [ ] Create `/settings/profile/page.tsx` (user profile)
- [ ] Create `/settings/accounting/page.tsx` (accounting settings)
- [ ] Create `/settings/accounting/chart-of-accounts/page.tsx` (COA management)
- [ ] Create `/settings/accounting/analysis-codes/page.tsx` (analysis codes)
- [ ] Create `/settings/integrations/page.tsx` (integrations)
- [ ] Create `/settings/billing/page.tsx` (billing - placeholder)
- [ ] Connect to settings API
- [ ] Test settings persistence

**Why Fourth:** Completes configuration UI. Users need to configure system.

---

**Phase 3 Deliverables:**
- ✅ Complete Customers module UI
- ✅ Complete Transactions module UI
- ✅ Complete Reporting suite
- ✅ Complete Settings UI

---

## PHASE 4: ADVANCED MODULES - DATABASE & BACKEND (Weeks 11-14)

**Goal:** Implement advanced modules starting with database schema

### Week 11: Payroll Module - Database & Backend

#### 11.1 Create Payroll Database Schema ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** None  
**Effort:** 1-2 days  
**Blocks:** Payroll Module

**Tasks:**
- [ ] Add `Employee` model to schema
- [ ] Add `PayrollRun` model
- [ ] Add `PayrollEntry` model
- [ ] Add `LeaveRequest` model
- [ ] Add `Timesheet` model
- [ ] Add `PensionContribution` model
- [ ] Add `TaxSubmission` model
- [ ] Add relations to Organization, User
- [ ] Run migration
- [ ] Update seed script

**Why First:** Database must exist before backend/frontend.

---

#### 11.2 Implement Payroll Backend Router ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Payroll Schema (#11.1)  
**Effort:** 3-4 days  
**Blocks:** Payroll Frontend

**Tasks:**
- [ ] Create `src/server/routers/payroll.ts`
- [ ] Implement `payroll.employees.getAll`
- [ ] Implement `payroll.employees.create`
- [ ] Implement `payroll.employees.update`
- [ ] Implement `payroll.leave.getAll`
- [ ] Implement `payroll.leave.create`
- [ ] Implement `payroll.timesheets.getAll`
- [ ] Implement `payroll.timesheets.create`
- [ ] Implement `payroll.runs.create` (payroll processing)
- [ ] Implement `payroll.runs.getAll`
- [ ] Implement `payroll.submissions.create` (RTI, pension, tax)
- [ ] Add to `appRouter`
- [ ] Test payroll calculations

**Why Second:** Backend before frontend. Payroll logic is complex.

---

### Week 12: Tax Module - Database & Backend

#### 12.1 Create Tax Database Schema ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** None  
**Effort:** 1 day  
**Blocks:** Tax Module

**Tasks:**
- [ ] Add `VATReturn` model
- [ ] Add `VATSubmission` model
- [ ] Add `CorporationTaxComputation` model
- [ ] Add `TaxPeriod` model
- [ ] Add relations to Organization, Invoice, Bill
- [ ] Run migration
- [ ] Update seed script

**Why Third:** Database foundation for tax module.

---

#### 12.2 Implement Tax Backend Router ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Tax Schema (#12.1), Invoices Router, Bills Router  
**Effort:** 3-4 days  
**Blocks:** Tax Frontend

**Tasks:**
- [ ] Create `src/server/routers/tax.ts`
- [ ] Implement `tax.vat.calculate` (VAT calculation from invoices/bills)
- [ ] Implement `tax.vat.createReturn` (VAT return creation)
- [ ] Implement `tax.vat.submitMTD` (MTD submission - placeholder)
- [ ] Implement `tax.vat.submitNonMTD` (non-MTD submission)
- [ ] Implement `tax.corporationTax.calculate` (CT computation)
- [ ] Implement `tax.corporationTax.submit` (CT submission - placeholder)
- [ ] Add to `appRouter`
- [ ] Test tax calculations

**Why Fourth:** Tax logic is complex. Backend first.

---

### Week 13: Fixed Assets & Inventory - Database & Backend

#### 13.1 Create Fixed Assets Database Schema ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** None  
**Effort:** 1-2 days  
**Blocks:** Fixed Assets Module

**Tasks:**
- [ ] Add `FixedAsset` model
- [ ] Add `AssetCategory` model
- [ ] Add `DepreciationSchedule` model
- [ ] Add `AssetDisposal` model
- [ ] Add `ROUAsset` model (IFRS 16)
- [ ] Add relations to Organization, ChartOfAccount
- [ ] Run migration

**Why Fifth:** Database for fixed assets.

---

#### 13.2 Create Inventory Database Schema ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** None  
**Effort:** 1-2 days  
**Blocks:** Inventory Module

**Tasks:**
- [ ] Add `InventoryItem` model
- [ ] Add `StockMovement` model
- [ ] Add `InventoryCategory` model
- [ ] Add `StockAlert` model
- [ ] Add `InventoryAdjustment` model
- [ ] Add relations to Organization, ChartOfAccount
- [ ] Run migration

**Why Sixth:** Database for inventory.

---

#### 13.3 Implement Fixed Assets Backend Router ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Fixed Assets Schema (#13.1)  
**Effort:** 2-3 days  
**Blocks:** Fixed Assets Frontend

**Tasks:**
- [ ] Create `src/server/routers/fixedAssets.ts`
- [ ] Implement `fixedAssets.getAll`
- [ ] Implement `fixedAssets.create`
- [ ] Implement `fixedAssets.calculateDepreciation`
- [ ] Implement `fixedAssets.dispose`
- [ ] Add to `appRouter`

**Why Seventh:** Backend for fixed assets.

---

#### 13.4 Implement Inventory Backend Router ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Inventory Schema (#13.2)  
**Effort:** 2-3 days  
**Blocks:** Inventory Frontend

**Tasks:**
- [ ] Create `src/server/routers/inventory.ts`
- [ ] Implement `inventory.items.getAll`
- [ ] Implement `inventory.items.create`
- [ ] Implement `inventory.movements.create` (stock in/out)
- [ ] Implement `inventory.alerts.check` (low stock)
- [ ] Implement `inventory.adjustments.create`
- [ ] Add to `appRouter`

**Why Eighth:** Backend for inventory.

---

### Week 14: Projects & Period End - Database & Backend

#### 14.1 Create Projects & Grants Database Schema ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** None  
**Effort:** 1-2 days  
**Blocks:** Projects Module

**Tasks:**
- [ ] Add `Project` model
- [ ] Add `ProjectBudget` model
- [ ] Add `ProjectTransaction` model
- [ ] Add `Grant` model
- [ ] Add `GrantAllocation` model
- [ ] Add `WorkInProgress` model
- [ ] Add relations to Organization, ChartOfAccount, Transaction
- [ ] Run migration

**Why Ninth:** Database for projects.

---

#### 14.2 Create Period End Database Schema ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** None  
**Effort:** 1 day  
**Blocks:** Period End Module

**Tasks:**
- [ ] Add `PeriodLock` model
- [ ] Add `Accrual` model
- [ ] Add `Prepayment` model
- [ ] Add `PeriodEndChecklist` model
- [ ] Add `PeriodEndRoutine` model
- [ ] Add relations to Organization, Transaction
- [ ] Run migration

**Why Tenth:** Database for period end.

---

#### 14.3 Implement Projects Backend Router ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Projects Schema (#14.1)  
**Effort:** 2-3 days  
**Blocks:** Projects Frontend

**Tasks:**
- [ ] Create `src/server/routers/projects.ts`
- [ ] Implement `projects.getAll`
- [ ] Implement `projects.create`
- [ ] Implement `projects.getBudget`
- [ ] Implement `projects.getTransactions`
- [ ] Implement `projects.calculateWIP`
- [ ] Add to `appRouter`

**Why Eleventh:** Backend for projects.

---

#### 14.4 Implement Period End Backend Router ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Period End Schema (#14.2)  
**Effort:** 2-3 days  
**Blocks:** Period End Frontend

**Tasks:**
- [ ] Create `src/server/routers/periodEnd.ts`
- [ ] Implement `periodEnd.getChecklist`
- [ ] Implement `periodEnd.createAccrual`
- [ ] Implement `periodEnd.createPrepayment`
- [ ] Implement `periodEnd.lockPeriod`
- [ ] Implement `periodEnd.runRoutine`
- [ ] Add to `appRouter`

**Why Twelfth:** Backend for period end.

---

**Phase 4 Deliverables:**
- ✅ Payroll database and backend
- ✅ Tax database and backend
- ✅ Fixed Assets database and backend
- ✅ Inventory database and backend
- ✅ Projects database and backend
- ✅ Period End database and backend

---

## PHASE 5: ADVANCED MODULES - FRONTEND (Weeks 15-18)

**Goal:** Build user interfaces for advanced modules

### Week 15: Payroll & Tax Frontend

#### 15.1 Implement Payroll Frontend Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Payroll Backend (#11.2)  
**Effort:** 3-4 days  
**Blocks:** Payroll Module Completion

**Tasks:**
- [ ] Create `/payroll/employees/page.tsx`
- [ ] Create `/payroll/leave/page.tsx`
- [ ] Create `/payroll/timesheets/page.tsx`
- [ ] Create `/payroll/pay-salaries/page.tsx`
- [ ] Create `/payroll/pension-submission/page.tsx`
- [ ] Create `/payroll/rti-submission/page.tsx`
- [ ] Create `/payroll/taxes-submission/page.tsx`
- [ ] Connect to backend
- [ ] Test payroll workflows

**Why First:** Complete payroll module.

---

#### 15.2 Implement Tax Frontend Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Tax Backend (#12.2)  
**Effort:** 2-3 days  
**Blocks:** Tax Module Completion

**Tasks:**
- [ ] Create `/tax/vat-mtd/page.tsx`
- [ ] Create `/tax/vat-non-mtd/page.tsx`
- [ ] Create `/tax/corporation-tax/page.tsx`
- [ ] Connect to backend
- [ ] Test tax workflows

**Why Second:** Complete tax module.

---

### Week 16: Fixed Assets & Inventory Frontend

#### 16.1 Implement Fixed Assets Frontend Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Fixed Assets Backend (#13.3)  
**Effort:** 2-3 days  
**Blocks:** Fixed Assets Module Completion

**Tasks:**
- [ ] Create `/accounting/fixed-assets/page.tsx`
- [ ] Create `/accounting/fixed-assets/[id]/page.tsx`
- [ ] Create `/accounting/fixed-assets/depreciation/page.tsx`
- [ ] Connect to backend
- [ ] Test asset workflows

**Why Third:** Complete fixed assets module.

---

#### 16.2 Implement Inventory Frontend Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Inventory Backend (#13.4)  
**Effort:** 2-3 days  
**Blocks:** Inventory Module Completion

**Tasks:**
- [ ] Create `/accounting/inventory/page.tsx`
- [ ] Create `/accounting/inventory/[id]/page.tsx`
- [ ] Create `/accounting/inventory/movements/page.tsx`
- [ ] Create `/accounting/inventory/alerts/page.tsx`
- [ ] Connect to backend
- [ ] Test inventory workflows

**Why Fourth:** Complete inventory module.

---

### Week 17: Projects & Period End Frontend

#### 17.1 Implement Projects Frontend Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Projects Backend (#14.3)  
**Effort:** 2-3 days  
**Blocks:** Projects Module Completion

**Tasks:**
- [ ] Create `/projects/page.tsx`
- [ ] Create `/projects/[id]/page.tsx`
- [ ] Create `/grants/page.tsx`
- [ ] Create `/grants/[id]/page.tsx`
- [ ] Connect to backend
- [ ] Test project workflows

**Why Fifth:** Complete projects module.

---

#### 17.2 Implement Period End Frontend Pages ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Period End Backend (#14.4)  
**Effort:** 2-3 days  
**Blocks:** Period End Module Completion

**Tasks:**
- [ ] Create `/accounting/period-end/page.tsx`
- [ ] Create `/accounting/period-end/accruals/page.tsx`
- [ ] Create `/accounting/period-end/prepayments/page.tsx`
- [ ] Create `/accounting/period-end/lock/page.tsx`
- [ ] Connect to backend
- [ ] Test period end workflows

**Why Sixth:** Complete period end module.

---

### Week 18: Forecasting & Additional Reports

#### 18.1 Create Forecasting Database Schema ⚠️ LOW
**Priority:** 🟢 LOW  
**Dependencies:** None  
**Effort:** 1 day  
**Blocks:** Forecasting Module

**Tasks:**
- [ ] Add `Budget` model
- [ ] Add `BudgetLine` model
- [ ] Add `Forecast` model
- [ ] Add `ForecastLine` model
- [ ] Add `BudgetVariance` model
- [ ] Run migration

**Why Seventh:** Database for forecasting.

---

#### 18.2 Implement Forecasting Backend & Frontend ⚠️ LOW
**Priority:** 🟢 LOW  
**Dependencies:** Forecasting Schema (#18.1)  
**Effort:** 3-4 days  
**Blocks:** Forecasting Module Completion

**Tasks:**
- [ ] Create `src/server/routers/forecasting.ts`
- [ ] Implement `forecasting.budgets.create`
- [ ] Implement `forecasting.forecasts.generate`
- [ ] Implement `forecasting.variance.calculate`
- [ ] Create `/reports/forecasting/page.tsx`
- [ ] Connect to backend
- [ ] Test forecasting workflows

**Why Eighth:** Complete forecasting module.

---

**Phase 5 Deliverables:**
- ✅ Complete Payroll module (frontend + backend)
- ✅ Complete Tax module (frontend + backend)
- ✅ Complete Fixed Assets module
- ✅ Complete Inventory module
- ✅ Complete Projects module
- ✅ Complete Period End module
- ✅ Complete Forecasting module

---

## PHASE 6: ADVANCED INTEGRATIONS (Weeks 19-22)

**Goal:** Add external service integrations

### Week 19: Payment Processing Integration

#### 19.1 Implement Stripe Integration ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Invoices Router, Payments Router  
**Effort:** 3-4 days  
**Blocks:** Online Payment Acceptance

**Tasks:**
- [ ] Install Stripe SDK
- [ ] Create Stripe configuration
- [ ] Implement payment link generation
- [ ] Implement webhook handler
- [ ] Update invoice payment recording
- [ ] Add payment status updates
- [ ] Test payment flow

**Why First:** Enables online payments. High user value.

---

### Week 20: Banking Integration

#### 20.1 Implement Open Banking Integration ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Bank Accounts Router (#7.1)  
**Effort:** 4-5 days  
**Blocks:** Automated Bank Feeds

**Tasks:**
- [ ] Choose Open Banking provider (Yapily, TrueLayer, etc.)
- [ ] Implement bank connection flow
- [ ] Implement transaction fetching
- [ ] Implement auto-reconciliation
- [ ] Add bank feed scheduling
- [ ] Test with sandbox

**Why Second:** Automates bank reconciliation. High value but complex.

---

### Week 21: OCR & AI Integration

#### 21.1 Implement OCR Integration ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** File Storage (#5.1)  
**Effort:** 2-3 days  
**Blocks:** Automated Receipt Processing

**Tasks:**
- [ ] Choose OCR service (Tesseract.js, Google Vision, AWS Textract)
- [ ] Implement receipt text extraction
- [ ] Implement invoice data extraction
- [ ] Add OCR to expense creation
- [ ] Test accuracy

**Why Third:** Automates data entry. High user value.

---

#### 21.2 Implement AI Categorization ⚠️ LOW
**Priority:** 🟢 LOW  
**Dependencies:** OCR (#21.1)  
**Effort:** 2-3 days  
**Blocks:** Smart Expense Categorization

**Tasks:**
- [ ] Choose AI service (OpenAI, etc.)
- [ ] Implement expense categorization
- [ ] Implement account code suggestion
- [ ] Add to expense creation
- [ ] Test accuracy

**Why Fourth:** Enhances OCR. Nice to have.

---

### Week 22: Third-Party Integrations

#### 22.1 Implement HMRC API Integration ⚠️ MEDIUM
**Priority:** 🟡 MEDIUM  
**Dependencies:** Tax Backend (#12.2)  
**Effort:** 3-4 days  
**Blocks:** Automated Tax Submissions

**Tasks:**
- [ ] Register for HMRC API
- [ ] Implement OAuth flow
- [ ] Implement VAT submission
- [ ] Implement RTI submission
- [ ] Test with sandbox

**Why Fifth:** Automates UK tax submissions. UK-specific.

---

#### 22.2 Implement Xero/QuickBooks Integration (Optional) ⚠️ LOW
**Priority:** 🟢 LOW  
**Dependencies:** All core modules  
**Effort:** 5-7 days  
**Blocks:** Data Migration

**Tasks:**
- [ ] Choose integration (Xero or QuickBooks)
- [ ] Implement OAuth flow
- [ ] Implement data export
- [ ] Implement data import
- [ ] Test migration

**Why Sixth:** Enables migration from other systems. Optional.

---

**Phase 6 Deliverables:**
- ✅ Stripe payment processing
- ✅ Open Banking integration
- ✅ OCR for receipts
- ✅ AI categorization
- ✅ HMRC API integration
- ✅ Optional third-party integrations

---

## PHASE 7: POLISH & PRODUCTION READINESS (Weeks 23-26)

**Goal:** Production hardening, testing, optimization

### Week 23: Testing & Quality Assurance

#### 23.1 Comprehensive Testing Suite ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** All previous phases  
**Effort:** 5-7 days  
**Blocks:** Production Release

**Tasks:**
- [ ] Write unit tests for all routers
- [ ] Write integration tests for workflows
- [ ] Write E2E tests for critical paths
- [ ] Write performance tests
- [ ] Write security tests
- [ ] Achieve 80%+ code coverage
- [ ] Fix all critical bugs

**Why First:** Quality assurance before production.

---

### Week 24: Performance Optimization

#### 24.1 Performance Optimization ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** All features implemented  
**Effort:** 3-4 days  
**Blocks:** Production Readiness

**Tasks:**
- [ ] Implement Redis caching
- [ ] Optimize database queries
- [ ] Add database indexes
- [ ] Implement CDN for static assets
- [ ] Optimize bundle size
- [ ] Implement lazy loading
- [ ] Load testing and optimization

**Why Second:** Performance critical for production.

---

### Week 25: Security Hardening

#### 25.1 Security Audit & Hardening ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** All features implemented  
**Effort:** 3-4 days  
**Blocks:** Production Release

**Tasks:**
- [ ] Security audit
- [ ] Penetration testing
- [ ] Fix security vulnerabilities
- [ ] Implement rate limiting
- [ ] Enhance input validation
- [ ] Review access controls
- [ ] Security documentation

**Why Third:** Security is non-negotiable.

---

### Week 26: Documentation & Deployment

#### 26.1 Complete Documentation ⚠️ HIGH
**Priority:** 🟠 HIGH  
**Dependencies:** All features implemented  
**Effort:** 2-3 days  
**Blocks:** User Onboarding

**Tasks:**
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User guide/manual
- [ ] Admin guide
- [ ] Developer guide
- [ ] Deployment guide
- [ ] Video tutorials

**Why Fourth:** Documentation essential for users and developers.

---

#### 26.2 Production Deployment Setup ⚠️ CRITICAL
**Priority:** 🔴 CRITICAL  
**Dependencies:** All previous work  
**Effort:** 3-4 days  
**Blocks:** Production Launch

**Tasks:**
- [ ] CI/CD pipeline setup
- [ ] Production environment configuration
- [ ] Database migration strategy
- [ ] Monitoring setup (Sentry, logs)
- [ ] Backup automation
- [ ] Rollback procedures
- [ ] Health checks
- [ ] Deployment runbook

**Why Fifth:** Final step before production.

---

**Phase 7 Deliverables:**
- ✅ Comprehensive test suite
- ✅ Performance optimized
- ✅ Security hardened
- ✅ Complete documentation
- ✅ Production deployment ready

---

## SUMMARY: IMPLEMENTATION SEQUENCE

### Quick Reference

**Phase 1 (Weeks 1-4):** Critical Backend Foundation
- Vendors → Bills → Payments → Payment Runs → Credit Notes → Reminders → Invoice Enhancements → Debit Notes → Amendments

**Phase 2 (Weeks 5-7):** Integrations & File Handling
- File Storage → PDF Export → Email → Reminders Email → Bank Reconciliation → Statement Import

**Phase 3 (Weeks 8-10):** Missing Frontend Pages
- Customers → Transactions → Reports → Settings

**Phase 4 (Weeks 11-14):** Advanced Modules - Database & Backend
- Payroll → Tax → Fixed Assets → Inventory → Projects → Period End

**Phase 5 (Weeks 15-18):** Advanced Modules - Frontend
- Payroll → Tax → Fixed Assets → Inventory → Projects → Period End → Forecasting

**Phase 6 (Weeks 19-22):** Advanced Integrations
- Stripe → Open Banking → OCR → AI → HMRC → Third-party

**Phase 7 (Weeks 23-26):** Polish & Production
- Testing → Performance → Security → Documentation → Deployment

---

## CRITICAL PATH

The **absolute minimum** for a functional accounting system:

1. **Vendors Router** (Week 1)
2. **Bills Router** (Week 1)
3. **Payments Router** (Week 2)
4. **Payment Runs Router** (Week 2)
5. **File Storage** (Week 5)
6. **PDF Export** (Week 5)
7. **Email Integration** (Week 6)
8. **Customers Pages** (Week 8)
9. **Transactions Pages** (Week 8)

**This critical path enables:**
- ✅ Complete expense management
- ✅ Supplier payments
- ✅ Invoice management (already exists)
- ✅ Basic reporting (already exists)

**Estimated Time:** 8-10 weeks for critical path

---

## DEPENDENCY GRAPH

```
Vendors Router
    ↓
Bills Router → Payment Runs Router
    ↓              ↓
Payments Router → Accounting Transactions
    ↓
Invoice Enhancements
    ↓
Credit Notes / Debit Notes
    ↓
Reminders (requires Email)
    ↓
File Storage → PDF Export → Email Integration
    ↓
All Frontend Pages
    ↓
Advanced Modules (can be parallel)
    ↓
Integrations (can be parallel)
    ↓
Testing & Production
```

---

## RISK MITIGATION

### High-Risk Items (Address Early)

1. **Email Integration** - Complex, many dependencies
   - **Mitigation:** Start early, use reliable provider, have fallback

2. **Payment Processing** - Security critical, regulatory requirements
   - **Mitigation:** Use established provider (Stripe), follow PCI compliance

3. **Open Banking** - Complex API, multiple providers
   - **Mitigation:** Start with manual import, add automation later

4. **Payroll Calculations** - Complex business logic, legal compliance
   - **Mitigation:** Use established payroll libraries, thorough testing

5. **Tax Calculations** - Country-specific, complex rules
   - **Mitigation:** Start with UK only, use HMRC guidelines

---

## PARALLELIZATION OPPORTUNITIES

These can be worked on in parallel:

- **Phase 4 & 5:** Advanced modules can be developed in parallel (different developers)
- **Phase 6:** Integrations can be developed in parallel
- **Frontend & Backend:** Can be developed in parallel with clear API contracts
- **Documentation:** Can be written alongside development

---

## ESTIMATED TIMELINE

- **Critical Path:** 8-10 weeks
- **Full Implementation:** 26 weeks (6.5 months)
- **With 2 Developers:** ~13-15 weeks (3-4 months)
- **With 3 Developers:** ~9-11 weeks (2-3 months)

---

## SUCCESS METRICS

Track progress with:
- ✅ Backend routers implemented
- ✅ Frontend pages created
- ✅ Integration endpoints functional
- ✅ Test coverage percentage
- ✅ Performance benchmarks
- ✅ Security audit results

---

**Document Version:** 1.0  
**Last Updated:** January 2024  
**Next Review:** After Phase 1 completion

