# QA Test Suites

This directory contains comprehensive QA test suites for hardening and validation.

## Week 6 QA Tests

### File Storage (6.1)
- `week6-file-storage.spec.ts` - Comprehensive tests for file storage integration

### Email & Reminders (6.2)
- `week6-email-reminders.spec.ts` - Comprehensive tests for email service and reminder automation

### Ledger Integrity
- `week6-ledger-integrity.spec.ts` - Tests to verify ledger integrity (DR=CR, zero-sum)

## Week 7 QA Tests

### Bank Reconciliation (7.1)
- `week7-bank-reconciliation.spec.ts` - Comprehensive tests for bank reconciliation features

### Bank Statement Import (7.2)
- `week7-bank-import.spec.ts` - Comprehensive tests for bank statement import functionality

### Ledger Integrity
- `week7-ledger-integrity.spec.ts` - Tests to verify ledger integrity for Week 7 features

## Week 8 QA Tests

### Customers Module (8.1)
- `week8-customers.spec.ts` - Comprehensive tests for customers module (CRUD, filters, search, security)

### Transactions Module (8.2)
- `week8-transactions.spec.ts` - Comprehensive tests for transactions module (journal entries, DR=CR validation, ledger integrity)

## Week 9 QA Tests

### Reports Module (9.1)
- `week9-reports.spec.ts` - Comprehensive tests for reports module (trial balance, cash flow, aged AR/AP, ledger integrity)

## Week 10 QA Tests

### Settings Module (10.1)
- `week10-settings.spec.ts` - Comprehensive tests for settings module (organisation, profile, accounting, permissions)

## Week 11 QA Tests

### Payroll Module (11.1)
- `week11-payroll.spec.ts` - Comprehensive tests for payroll module (employees, payroll runs, entries, approvals, security)

## Test Categories

### Happy Path Tests
- Test successful operations with valid inputs
- Verify expected responses and data structures

### Nasty Path Tests
- Test error handling with invalid inputs
- Verify proper error messages and status codes
- Test edge cases and boundary conditions

### Fuzz Validation Tests
- Test Zod schema validation with various invalid inputs
- Test min/max lengths, enums, number ranges
- Test special characters and edge cases

### Performance Tests
- Test list endpoints with 10k rows
- Verify response times are acceptable
- Test pagination performance

### Concurrency Tests
- Test idempotency (double-click prevention)
- Test concurrent operations
- Verify no duplicate data creation

### Security Tests
- Test cross-org data leak prevention
- Test soft-deleted data is hidden
- Test permission matrix enforcement

### Ledger Integrity Tests
- Verify every posting DR = CR
- Verify trial balance stays zero-sum
- Test that non-financial operations don't affect ledger

### Observability Tests
- Verify correlation IDs are present
- Verify errors are structured
- Verify audit entries are created

## Running Tests

```bash
# Run all QA tests
npx playwright test tests/qa

# Run specific test suite
npx playwright test tests/qa/week6-file-storage.spec.ts

# Run with UI
npx playwright test tests/qa --ui

# Run in headed mode
npx playwright test tests/qa --headed
```

## Test Data Requirements

Some tests require seeded data:
- 10k files for performance tests
- 10k emails for performance tests
- Multiple organizations for cross-org tests
- Users with different permission levels

Run `npm run demo:populate` to seed test data.
