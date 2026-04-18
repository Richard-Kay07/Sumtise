# Phase 2 - Demo Organisation Seed Summary

## Overview

The demo organization seed script has been updated to include Week 7 features:
- **7.1 Bank Reconciliation** - Bank transactions with reconciliation data
- **7.2 Bank Statement Import** - Import-ready transaction data

## Updated Seed Script

### File: `scripts/populate-demo-org.ts`

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
12. **2 Months of Bank Transactions** - 60 transactions:
    - 40 reconciled transactions (for testing reconciliation features)
    - 20 unreconciled transactions (for testing reconciliation workflow)
    - Mix of deposits and withdrawals
    - Various descriptions, payees, references
    - Running balances calculated
13. **20 File Uploads** - Files attached to invoices and bills

### Week 7 Enhancements

#### Bank Transactions
- **60 transactions** over 2 months
- **40 reconciled** - Already matched with ledger
- **20 unreconciled** - Available for reconciliation testing
- **Running balances** - Calculated per account
- **Rich metadata** - Payees, memos, references, categories
- **Mixed types** - Deposits (CREDIT) and withdrawals (DEBIT)

#### Bank Accounts
- **2 bank accounts** created
- Main Business Account (opening balance: £50,000)
- Operating Account (opening balance: £25,000)

## Running the Script

### Command
```bash
npm run demo:populate
```

Or directly:
```bash
npx tsx scripts/populate-demo-org.ts
```

### What It Does

1. **Resets** all existing demo organization data
2. **Creates** demo organization if it doesn't exist
3. **Seeds** all data deterministically
4. **Prints** admin credentials and important IDs

### Output

The script prints:
- Data summary (counts of each entity)
- Admin login credentials
- Important IDs for testing

Example output:
```
✅ Demo Organisation Population Complete!
============================================================

📊 Data Summary:
   Organization ID: clx...
   Admin User ID: clx...
   Vendors: 10
   Customers: 10
   Chart of Accounts: 25
   Invoices: 30
   Bills: 30
   Payments: 20
   Payment Runs: 2
   Credit Notes: 3
   Debit Notes: 2
   Journals: 10
   Bank Transactions: 60
   File Uploads: 20

🔑 Admin Login:
   Email: admin@sumtise.com
   Password: password123
   Organization: Demo Organisation (slug: demo-org)

📋 Important IDs:
   Organization: clx...
   Admin User: clx...
   First Vendor: clx...
   First Customer: clx...
   First Invoice: clx...
   First Bill: clx...
   First Bank Account: clx...
   First Bank Transaction: clx...
   Unreconciled Transactions: 20 (for testing reconciliation)
```

## Testing Week 7 Features

### Bank Reconciliation (7.1)

1. **Navigate to** `/banking/reconciliation`
2. **Select** a bank account
3. **View** unreconciled transactions (20 available)
4. **Test** match suggestions
5. **Reconcile** transactions
6. **View** reconciliation report

### Bank Statement Import (7.2)

1. **Navigate to** `/banking/import`
2. **Select** a bank account
3. **Upload** a CSV or OFX file
4. **Map** columns (for CSV)
5. **Preview** transactions
6. **Import** transactions
7. **View** results

## Data Characteristics

### Bank Transactions

- **Date Range**: 2 months (60 days)
- **Distribution**: 
  - Deposits: ~67% (40 transactions)
  - Withdrawals: ~33% (20 transactions)
- **Amounts**: Varying from £50 to £500
- **Reconciliation Status**:
  - 40 reconciled (first 40 transactions)
  - 20 unreconciled (last 20 transactions)
- **Metadata**:
  - Descriptions: Various business transactions
  - Payees: Customer/vendor names where applicable
  - References: Transaction reference numbers
  - Categories: SALES, EXPENSES, TRANSFER

### Deterministic Seeding

- Same data created every run
- Consistent IDs (after reset)
- Predictable test scenarios
- Easy to verify expected behavior

## Reset Behavior

The script **deterministically resets** all data:
- Deletes all existing data in correct order
- Respects foreign key constraints
- Re-creates all data with consistent structure
- Ensures same data every time

## Status

✅ **Seed Script Updated**
- Bank transactions: ✅ (60 transactions, 20 unreconciled)
- Bank accounts: ✅ (2 accounts)
- Reset logic: ✅ (includes reconciliation tables)
- Summary output: ✅ (includes bank transaction info)

**Ready for**: Running `npm run demo:populate`

## Next Steps

1. **Run the script**: `npm run demo:populate`
2. **Verify data**: Check that 60 bank transactions were created
3. **Test reconciliation**: Use unreconciled transactions for testing
4. **Test import**: Import additional statements if needed




