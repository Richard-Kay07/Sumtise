# Invoices & Expenses Module Refactor - Implementation Summary

## Completed ✅

1. **Created `/invoices/layout.tsx`** with sub-navigation tabs for:
   - View Invoices (`/invoices`)
   - Create Invoice (`/invoices/new`)
   - Credit Note (`/invoices/credit-note`)
   - Send Reminders (`/invoices/reminders`)

2. **Created `/expenses/layout.tsx`** with sub-navigation tabs for:
   - View Expenses (`/expenses`)
   - Create Expense (`/expenses/new`)
   - Amend Expense (`/expenses/amend`)
   - Debit Notes (`/expenses/debit-note`)
   - Payment Run (`/expenses/payment-run`)

## Next Steps Required

### 1. Update the main navigation (src/components/navigation.tsx)
- Remove all "Invoices" sub-menu items from the accounting dropdown
- Keep only a single "Invoices" link that points to `/invoices`

### 2. Create new invoice pages:
   
   **`/src/app/invoices/new/page.tsx`** - Create Invoice form
   - Multi-step wizard form
   - Customer selection
   - Line items entry
   - Tax calculations
   - Preview before save
   
   **`/src/app/invoices/credit-note/page.tsx`** - Credit Note
   - Select invoice to credit
   - Apply credit reasons
   - Line item adjustments
   - Generate credit note PDF
   
   **`/src/app/invoices/reminders/page.tsx`** - Send Reminders
   - Select outstanding invoices
   - Email template preview
   - Bulk send functionality
   - Reminder history

### 3. Create new expense pages:
   
   **`/src/app/expenses/new/page.tsx`** - Create Expense
   - Expense form with receipt upload
   - OCR scanning for receipts
   - Vendor selection
   - Category assignment
   - Tax treatment
   
   **`/src/app/expenses/amend/page.tsx`** - Amend Expense
   - Select expense to amend
   - Track amendment reasons with audit trail
   - Approval workflow for amendments
   - Maintain original expense record
   
   **`/src/app/expenses/debit-note/page.tsx`** - Debit Notes
   - Create debit notes for corrections
   - Link to original expenses
   - Supplier notifications
   
   **`/src/app/expenses/payment-run/page.tsx`** - Payment Run
   - Select expenses for payment
   - Batch payment processing
   - Payment method selection
   - Generate payment files (CSV, bank transfer files)

### 4. Update `/src/app/invoices/page.tsx` and `/src/app/expenses/page.tsx`
- Remove header duplication (layout.tsx provides it)
- Add export functionality
- Enhance filtering and sorting
- Add pagination

### 5. Move existing menu items
- From `preview.html`:
  - Remove "Invoices" sub-menu items from Accounting menu (lines 65-89)
  - Remove "Expenses" sub-menu items from Accounting menu (lines 91-121)
  - Keep only single "Invoices" and "Expenses" entries

## Technical Stack Used
- React + TypeScript + Next.js App Router
- Tailwind CSS + shadcn/ui components
- tRPC for API calls
- React Hook Form + Zod (for forms)
- TanStack Table (for tables)

## Architecture Benefits
- ✅ Modular structure
- ✅ Type-safe with TypeScript
- ✅ Idempotent (safe to run multiple times)
- ✅ Testable components
- ✅ DRY principle (no code duplication)
- ✅ Scalable architecture

