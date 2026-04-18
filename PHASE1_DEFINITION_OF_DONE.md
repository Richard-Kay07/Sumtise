# Phase 1 - Definition of Done Checklist

This checklist verifies that all Phase 1 features are complete and working end-to-end.

## ✅ 1. Expense + Payable Lifecycle (End-to-End)

### 1.1 Vendor Management
- [ ] **Create Vendor**: Can create new vendor with all required fields
- [ ] **List Vendors**: Can view paginated list of vendors with filters
- [ ] **Get Vendor**: Can retrieve single vendor with details
- [ ] **Update Vendor**: Can update vendor information
- [ ] **Delete Vendor**: Can soft-delete vendor (soft-delete working)
- [ ] **Vendor Validation**: Required fields validated, duplicate emails prevented
- [ ] **Permissions**: Viewers cannot edit, editors can edit, admins can delete

### 1.2 Bill Creation & Management
- [ ] **Create Bill**: Can create bill with line items
- [ ] **Bill Items**: Can add multiple line items with quantities, prices, tax rates
- [ ] **Bill Totals**: Subtotal, tax, and total calculated correctly
- [ ] **List Bills**: Can view paginated list with filters (status, vendor, date range)
- [ ] **Get Bill**: Can retrieve single bill with items
- [ ] **Update Bill**: Can update bill (only if DRAFT/RECEIVED)
- [ ] **Bill Numbering**: Auto-numbering works, unique numbers enforced
- [ ] **Bill Status**: Status transitions work (DRAFT → RECEIVED → APPROVED → PART_PAID → PAID)

### 1.3 Bill Approval & Posting
- [ ] **Approve Bill**: Can approve bill (status → APPROVED)
- [ ] **Ledger Posting**: Approval creates DR Expense, CR AP postings
- [ ] **Posting Balance**: All postings are DR=CR verified
- [ ] **Posted At**: `postedAt` timestamp set on approval
- [ ] **Approved By**: `approvedBy` user ID recorded
- [ ] **Cannot Edit Approved**: Approved bills cannot be directly edited (must use amendments)

### 1.4 Payments
- [ ] **Create Payment**: Can create payment with bill or vendor
- [ ] **Payment to Bill**: Payment linked to bill reduces bill balance
- [ ] **On-Account Payment**: Payment to vendor only creates on-account credit
- [ ] **Payment Posting**: Creates DR AP, CR Bank postings
- [ ] **Payment Methods**: Supports BANK_TRANSFER, CHEQUE, CARD, CASH
- [ ] **Payment Status**: Status transitions (DRAFT → PROCESSING → COMPLETED)
- [ ] **Bill Status Update**: Bill status updates to PART_PAID/PAID when payment applied
- [ ] **Payment History**: Can view payment history for bill or vendor
- [ ] **Idempotency**: Duplicate payments prevented with idempotency keys

### 1.5 Payment Reversal
- [ ] **Reverse Payment**: Can reverse completed payment
- [ ] **Reversing Journal**: Creates reversing journal entries
- [ ] **Bill Balance Restored**: Bill balance restored when payment reversed
- [ ] **Payment Status**: Payment marked as REVERSED with link to reversing entry
- [ ] **Audit Trail**: Reversal fully audited

### 1.6 Payment Runs
- [ ] **Create Payment Run**: Can create payment run with bill selection criteria
- [ ] **Bill Selection**: Can select bills by vendor, due date, amount
- [ ] **Payment Run Status**: Status transitions (DRAFT → PROCESSED)
- [ ] **Process Payment Run**: Creates payments for all selected bills
- [ ] **Idempotent Processing**: Processing is idempotent (can't duplicate payments)
- [ ] **Export File**: Can export payment run as BACS/CSV file
- [ ] **File Metadata**: Export file metadata stored
- [ ] **Transaction Wrapping**: All payments created in single transaction
- [ ] **Audit Entry**: Single audit entry with list of payments

### 1.7 Debit Notes
- [ ] **Create Debit Note**: Can create from bill or manually
- [ ] **From Bill**: Items auto-populated from source bill
- [ ] **Manual Creation**: Can create with manual items
- [ ] **Debit Note Numbering**: Auto-numbering (DN-YYYY-###)
- [ ] **Apply Debit Note**: Can apply to bill (reduces balance)
- [ ] **Partial Application**: Can partially apply to multiple bills
- [ ] **Over-Application Prevention**: Cannot apply more than remaining balance
- [ ] **Ledger Posting**: Creates DR AP, CR Expense Returns postings
- [ ] **Balance Tracking**: Bill balance updated correctly
- [ ] **Cancel Debit Note**: Can cancel if not applied
- [ ] **Status Management**: Status transitions (DRAFT → SENT → APPLIED → CANCELLED)

### 1.8 Bill Amendments
- [ ] **Create Amendment**: Can create amendment with before/after snapshots
- [ ] **Bill Locking**: Bill locked from direct edits when amendment created
- [ ] **Amendment Types**: Supports AMOUNT_CHANGE, DATE_CHANGE, VENDOR_CHANGE, ITEM_CHANGE, STATUS_CHANGE, OTHER
- [ ] **Approve Amendment**: Can approve and apply changes
- [ ] **Financial Impact Detection**: Detects amount/tax/account changes
- [ ] **Adjustment Journal**: Generates adjustment journal if financial impact
- [ ] **Journal Balance**: Adjustment journal is DR=CR
- [ ] **Reject Amendment**: Can reject amendment (unlocks bill, no changes)
- [ ] **Paid Bill Protection**: Cannot make financial changes to paid bills with zero balance
- [ ] **Memo Updates Allowed**: Can update memo/notes on paid bills
- [ ] **Audit Trail**: Full audit trail with before/after snapshots

## ✅ 2. Sales Lifecycle Enhanced

### 2.1 Invoice Management (Enhanced)
- [ ] **Create Invoice**: Can create invoice with line items
- [ ] **Invoice Items**: Can add multiple line items
- [ ] **Invoice Totals**: Subtotal, tax, and total calculated correctly
- [ ] **List Invoices**: Can view paginated list with filters
- [ ] **Get Invoice**: Can retrieve single invoice with items
- [ ] **Outstanding Invoices**: Can get list of outstanding invoices
- [ ] **Record Payment**: Can record payment against invoice
- [ ] **Mark as Paid**: Can mark invoice as paid
- [ ] **Get Payments**: Can view payment history for invoice
- [ ] **Duplicate Invoice**: Can duplicate invoice (new number, DRAFT status)
- [ ] **Status Management**: Status updates based on payments (DRAFT → SENT → PART_PAID → PAID)

### 2.2 Credit Notes
- [ ] **Create Credit Note**: Can create from invoice or manually
- [ ] **From Invoice**: Items auto-populated from source invoice
- [ ] **Manual Creation**: Can create with manual items
- [ ] **Credit Note Numbering**: Auto-numbering (CN-YYYY-###)
- [ ] **Apply Credit Note**: Can apply to invoice (reduces balance)
- [ ] **Partial Application**: Can partially apply to multiple invoices
- [ ] **Over-Application Prevention**: Cannot apply more than remaining balance
- [ ] **Ledger Posting**: Creates DR Revenue Returns, CR AR postings
- [ ] **Balance Tracking**: Invoice balance updated correctly
- [ ] **Cancel Credit Note**: Can cancel if not applied
- [ ] **Status Management**: Status transitions (DRAFT → SENT → APPLIED → CANCELLED)

### 2.3 Invoice Reminders
- [ ] **Create Reminder Schedule**: Can create reminder schedule
- [ ] **Get Outstanding Invoices**: Returns invoices due/overdue, excludes already reminded
- [ ] **Cool-Down Period**: Respects cool-down period (no duplicate reminders)
- [ ] **Send Reminder**: Can send reminder for single invoice
- [ ] **Send Bulk Reminders**: Can send reminders for all due invoices
- [ ] **Email Outbox**: Creates entries in email outbox table
- [ ] **Reminder Templates**: Can get reminder templates with placeholders
- [ ] **Reminder History**: Can view reminder history for invoice
- [ ] **Reminder Status**: `reminderSentAt` timestamp recorded

## ✅ 3. Payment Run with Export

### 3.1 Payment Run Creation
- [ ] **Create with Criteria**: Can create with selection criteria (vendorIds, dueDateTo, minAmount)
- [ ] **Create with Bill IDs**: Can create with explicit bill IDs
- [ ] **Bill Snapshot**: Bills snapshot stored in payment run
- [ ] **Bank Account**: Bank account stored in payment run
- [ ] **Status DRAFT**: Initial status is DRAFT

### 3.2 Payment Run Processing
- [ ] **Validate Balances**: Validates bill balances before processing
- [ ] **Create Payments**: Creates payment for each bill
- [ ] **Update Bills**: Updates bill statuses (PART_PAID/PAID)
- [ ] **Status PROCESSED**: Status changes to PROCESSED
- [ ] **Transaction Wrapping**: All operations in single transaction
- [ ] **Rollback on Error**: Rolls back on any error
- [ ] **Idempotent**: Can't process same run twice (idempotent)
- [ ] **Audit Entry**: Single audit entry with list of payments

### 3.3 Payment Run Export
- [ ] **Export File**: Can export payment run as file
- [ ] **BACS Format**: Supports BACS format export
- [ ] **CSV Format**: Supports CSV format export
- [ ] **File Metadata**: File metadata stored (fileRef, format, size)
- [ ] **File Storage**: File stored or file reference saved
- [ ] **Export Status**: Export status tracked

## ✅ 4. Audit Trails + Postings Verified by Tests

### 4.1 Audit Trail Verification
- [ ] **Create Operations**: All create operations logged
- [ ] **Update Operations**: All update operations logged (before/after)
- [ ] **Delete Operations**: All delete operations logged
- [ ] **Financial Operations**: All financial operations logged
- [ ] **User Tracking**: User ID recorded in all audit entries
- [ ] **Timestamp Tracking**: Timestamps recorded for all operations
- [ ] **Metadata**: Relevant metadata stored in audit entries
- [ ] **Amendment Audit**: Bill amendments fully audited
- [ ] **Payment Audit**: Payments and reversals fully audited

### 4.2 Ledger Posting Verification
- [ ] **Bills Approval**: DR Expense, CR AP (verified DR=CR)
- [ ] **Payments**: DR AP, CR Bank (verified DR=CR)
- [ ] **Payment Reversal**: Reversing entries (verified DR=CR)
- [ ] **Credit Notes**: DR Revenue Returns, CR AR (verified DR=CR)
- [ ] **Debit Notes**: DR AP, CR Expense Returns (verified DR=CR)
- [ ] **Bill Amendments**: Adjustment journal (verified DR=CR)
- [ ] **Trial Balance**: Trial balance remains zero-sum after all operations

### 4.3 Test Coverage
- [ ] **E2E Tests**: All routers have E2E tests
- [ ] **Happy Path Tests**: All happy path scenarios tested
- [ ] **Nasty Path Tests**: All error scenarios tested
- [ ] **Security Tests**: Cross-org, permissions, soft-delete tested
- [ ] **Ledger Integrity Tests**: All postings verified DR=CR
- [ ] **Performance Tests**: List endpoints tested with pagination
- [ ] **Concurrency Tests**: Idempotency and double-click prevention tested
- [ ] **Fuzz Validation**: Input validation tested (min/max, enums, ranges)
- [ ] **Observability Tests**: Correlation IDs, structured errors, audits tested

### 4.4 Test Results
- [ ] **All Tests Pass**: All E2E tests passing
- [ ] **QA Tests Pass**: All QA tests passing
- [ ] **Ledger Tests Pass**: All ledger integrity tests passing
- [ ] **Security Tests Pass**: All security tests passing
- [ ] **Performance Acceptable**: All performance tests within acceptable limits

## ✅ 5. Integration & Data

### 5.1 Demo Data
- [ ] **Demo Org Populated**: Demo organization has all test data
- [ ] **10 Vendors**: 10 vendors created
- [ ] **10 Customers**: 10 customers created
- [ ] **30 Bills**: 30 bills with various statuses
- [ ] **30 Invoices**: 30 invoices with various statuses
- [ ] **20 Payments**: 20 payments created
- [ ] **2 Payment Runs**: 2 payment runs (1 processed, 1 draft)
- [ ] **3 Credit Notes**: 3 credit notes created
- [ ] **2 Debit Notes**: 2 debit notes created
- [ ] **10 Journals**: 10 journal entries created
- [ ] **2 Months Bank Transactions**: 60 bank transactions created
- [ ] **20 File Uploads**: 20 files attached to documents

### 5.2 Chart of Accounts
- [ ] **Standard COA**: Standard UK chart of accounts created
- [ ] **All Account Types**: Assets, Liabilities, Equity, Revenue, Expenses
- [ ] **Account Codes**: Proper account codes assigned
- [ ] **Account Hierarchy**: Parent-child relationships maintained

### 5.3 Tax Setup
- [ ] **Standard VAT**: Standard VAT (20%) configured
- [ ] **Reduced VAT**: Reduced VAT (5%) configured
- [ ] **Zero VAT**: Zero VAT configured
- [ ] **Exempt VAT**: VAT Exempt configured

## ✅ 6. Documentation

### 6.1 API Documentation
- [ ] **Router Documentation**: All routers have JSDoc comments
- [ ] **Endpoint Documentation**: All endpoints documented
- [ ] **Schema Documentation**: All schemas documented

### 6.2 Test Documentation
- [ ] **Test Files**: All test files have descriptions
- [ ] **QA Test Summary**: QA test summary document created
- [ ] **Test Execution Guide**: Test execution guide available

### 6.3 User Documentation
- [ ] **Demo Data Guide**: Demo data population guide available
- [ ] **Feature Documentation**: Feature documentation available

## ✅ 7. Code Quality

### 7.1 Code Standards
- [ ] **No Linter Errors**: All code passes linting
- [ ] **Type Safety**: All TypeScript types correct
- [ ] **Error Handling**: All errors properly handled
- [ ] **Input Validation**: All inputs validated with Zod

### 7.2 Security
- [ ] **Permission Checks**: All endpoints check permissions
- [ ] **Resource Ownership**: All endpoints verify resource ownership
- [ ] **Cross-Org Protection**: Cross-org access prevented
- [ ] **Soft-Delete**: Soft-deleted items hidden

### 7.3 Performance
- [ ] **Pagination**: All list endpoints paginated
- [ ] **Indexes**: Database indexes on foreign keys and filters
- [ ] **Query Optimization**: Queries optimized for performance

## ✅ 8. Deployment Readiness

### 8.1 Database
- [ ] **Migrations**: All migrations applied
- [ ] **Schema Up to Date**: Schema matches code
- [ ] **Indexes Created**: All indexes created

### 8.2 Environment
- [ ] **Environment Variables**: All required env vars set
- [ ] **Database Connection**: Database connection working
- [ ] **File Storage**: File storage configured

### 8.3 Monitoring
- [ ] **Error Logging**: Error logging configured
- [ ] **Audit Logging**: Audit logging working
- [ ] **Performance Monitoring**: Performance monitoring in place

## Verification Commands

### Run All Tests
```bash
npm run test:all
```

### Run E2E Tests
```bash
npm run test:e2e
```

### Run QA Tests
```bash
npx playwright test tests/qa/
```

### Run Ledger Integrity Tests
```bash
npx playwright test tests/qa/ledger-integrity.spec.ts
```

### Populate Demo Data
```bash
npm run demo:populate
```

### Check Database
```bash
npm run db:studio
```

## Completion Criteria

Phase 1 is considered **DONE** when:

1. ✅ All checklist items above are checked
2. ✅ All tests pass (100% pass rate)
3. ✅ Ledger integrity verified (all DR=CR)
4. ✅ Audit trails complete for all operations
5. ✅ Demo organization populated with test data
6. ✅ Documentation complete
7. ✅ Code review passed
8. ✅ Security review passed

## Sign-Off

- [ ] **Developer**: All features implemented and tested
- [ ] **QA**: All tests passing, no critical bugs
- [ ] **Security**: Security review passed
- [ ] **Product**: Features meet requirements
- [ ] **Technical Lead**: Code quality and architecture approved

---

**Last Updated**: [Date]
**Status**: [In Progress / Complete]




