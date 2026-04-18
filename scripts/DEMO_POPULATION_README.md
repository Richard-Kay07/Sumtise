# Demo Organisation Population Script

This script populates the demo organization with comprehensive test data for development and testing.

## Usage

```bash
npm run demo:populate
```

Or directly:

```bash
npx tsx scripts/populate-demo-org.ts
```

## What It Does

The script **resets and re-seeds** the demo organization (`demo-org`) with the following data:

### Data Created

1. **10 Vendors** - Various suppliers with different payment terms
2. **10 Customers** - Different customers with credit limits
3. **Standard Chart of Accounts** - Complete UK chart of accounts structure
4. **Standard VAT Taxes** - Standard (20%), Reduced (5%), Zero (0%), Exempt
5. **30 Invoices** - Mix of DRAFT, SENT, PAID, OVERDUE statuses
6. **30 Bills** - Mix of DRAFT, RECEIVED, APPROVED, PART_PAID, PAID statuses
7. **20 Payments** - Various payment methods and statuses
8. **2 Payment Runs** - One PROCESSED, one DRAFT
9. **3 Credit Notes** - Applied and SENT statuses
10. **2 Debit Notes** - Applied and SENT statuses
11. **10 Journals** - Manual journal entries (DR=CR)
12. **2 Months of Bank Transactions** - 60 transactions (deposits and withdrawals)
13. **20 File Uploads** - Files attached to invoices and bills

### Reset Behavior

The script **deterministically resets** all data:
- Deletes all existing data in the correct order (respecting foreign keys)
- Re-creates all data with consistent IDs
- Ensures the same data is created every time

### Admin Credentials

After running, the script prints:
- **Email**: `admin@sumtise.com`
- **Password**: `password123`
- **Organization**: Demo Organisation (slug: `demo-org`)

### Important IDs

The script prints important IDs for testing:
- Organization ID
- Admin User ID
- First Vendor ID
- First Customer ID
- First Invoice ID
- First Bill ID
- First Bank Account ID

## Data Distribution

### Invoices
- 30 invoices distributed over 2 months
- Mix of statuses: DRAFT, SENT, PAID, OVERDUE
- Various amounts and customers

### Bills
- 30 bills distributed over 2 months
- Mix of statuses: DRAFT, RECEIVED, APPROVED, PART_PAID, PAID
- Various amounts and vendors
- Some bills are approved and posted

### Payments
- 20 payments linked to bills
- Various payment methods: BANK_TRANSFER, CHEQUE, CARD, CASH
- All marked as COMPLETED

### Payment Runs
- 2 payment runs
- First is PROCESSED (contains 10 bills)
- Second is DRAFT (contains 10 bills)

### Credit Notes
- 3 credit notes linked to invoices
- First is APPLIED, others are SENT

### Debit Notes
- 2 debit notes linked to bills
- First is APPLIED, second is SENT

### Journals
- 10 manual journal entries
- All entries are balanced (DR=CR)
- Distributed over 1 month

### Bank Transactions
- 60 transactions over 2 months
- Mix of deposits and withdrawals
- All marked as RECONCILED

### Files
- 20 file uploads
- 10 attached to invoices (category: INVOICES)
- 10 attached to bills (category: RECEIPTS)
- All PDF files with varying sizes

## Notes

- The script uses deterministic data generation
- All dates are relative to the current date (2 months back)
- Amounts are calculated with some randomization for realism
- The script handles foreign key relationships correctly
- All data is created in the correct order

## Troubleshooting

### If script fails:
1. Check database connection
2. Ensure Prisma schema is up to date (`npm run db:push`)
3. Check that demo organization doesn't have conflicting data
4. Review error messages for specific issues

### If data seems incomplete:
1. Check console output for any errors
2. Verify all foreign key relationships exist
3. Ensure all required accounts exist in Chart of Accounts

## Integration with Tests

This script is designed to work with:
- E2E tests (`tests/e2e/`)
- QA tests (`tests/qa/`)
- Smoke tests (`tests/smoke/`)

All tests can assume the demo organization exists with this data.




