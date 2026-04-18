# Demo Organisation Population - Instructions

## Script Status

✅ **Script Updated and Ready**

The demo population script has been updated to include Week 7 features:
- 2 months of bank transactions (60 transactions)
- 40 reconciled transactions
- 20 unreconciled transactions (for testing reconciliation)
- All Week 7 data structures included

## How to Run

### Option 1: Using npm (Recommended)
```bash
npm run demo:populate
```

### Option 2: Using npx directly
```bash
npx tsx scripts/populate-demo-org.ts
```

### Option 3: Using tsx directly (if installed globally)
```bash
tsx scripts/populate-demo-org.ts
```

### Option 4: Using Node.js with tsx loader
```bash
node --loader tsx scripts/populate-demo-org.ts
```

## Prerequisites

1. **Node.js** installed (v18 or higher recommended)
2. **npm** or **yarn** package manager
3. **Dependencies installed**: Run `npm install` first
4. **Database connection**: Ensure your `.env` file has correct database connection string
5. **Prisma client generated**: Run `npx prisma generate` if needed

## What the Script Does

1. **Resets** all existing demo organization data
2. **Creates** demo organization (`demo-org`) if it doesn't exist
3. **Seeds** comprehensive test data:
   - 10 Vendors
   - 10 Customers
   - Standard Chart of Accounts
   - Standard VAT Taxes
   - 30 Invoices
   - 30 Bills
   - 20 Payments
   - 2 Payment Runs
   - 3 Credit Notes
   - 2 Debit Notes
   - 10 Journals
   - **60 Bank Transactions** (40 reconciled, 20 unreconciled)
   - 20 File Uploads

## Expected Output

```
🚀 Starting Demo Organisation Population...

🔄 Resetting demo organization...
✅ Demo organization reset complete
🔍 Ensuring demo organization exists...
✅ Created Demo Org
📊 Seeding chart of accounts...
✅ Created 25 chart of accounts
💰 Seeding taxes...
✅ Created 4 tax codes
🏢 Seeding 10 vendors...
✅ Created 10 vendors
👥 Seeding 10 customers...
✅ Created 10 customers
🏦 Seeding bank accounts...
✅ Created 2 bank accounts
📄 Seeding 30 invoices...
✅ Created 30 invoices
📋 Seeding 30 bills...
✅ Created 30 bills
💳 Seeding 20 payments...
✅ Created 20 payments
📦 Seeding 2 payment runs...
✅ Created 2 payment runs
📝 Seeding 3 credit notes...
✅ Created 3 credit notes
📝 Seeding 2 debit notes...
✅ Created 2 debit notes
📔 Seeding 10 journals...
✅ Created 10 journals
🏦 Seeding 2 months of bank transactions...
✅ Created 60 bank transactions (40 reconciled, 20 unreconciled)
📎 Seeding files attached to 20 documents...
✅ Created 20 file uploads

============================================================
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

✨ All data seeded deterministically!
```

## Troubleshooting

### Node.js/npm not found
If you see "command not found: npm", ensure:
1. Node.js is installed: `node --version`
2. npm is installed: `npm --version`
3. PATH includes Node.js bin directory

### Database connection errors
- Check `.env` file has correct `DATABASE_URL`
- Ensure database is running
- Run `npx prisma db push` or migrations if needed

### Prisma client errors
- Run `npx prisma generate` to regenerate Prisma client
- Ensure schema is up to date: `npx prisma db push`

### TypeScript errors
- Ensure dependencies are installed: `npm install`
- Check that `tsx` is in `package.json` dependencies

## Testing After Population

### Bank Reconciliation (7.1)
1. Login with `admin@sumtise.com` / `password123`
2. Navigate to `/banking/reconciliation`
3. Select a bank account
4. You should see 20 unreconciled transactions
5. Test match suggestions and reconciliation

### Bank Statement Import (7.2)
1. Navigate to `/banking/import`
2. Select a bank account
3. Upload a CSV or OFX file
4. Test import and deduplication

## Script Location

- **File**: `scripts/populate-demo-org.ts`
- **Command**: `npm run demo:populate`
- **Type**: TypeScript script using Prisma

## Notes

- Script is **deterministic** - same data every run
- Script **resets** existing data before seeding
- All IDs are printed for easy testing
- 20 unreconciled transactions are available for reconciliation testing




