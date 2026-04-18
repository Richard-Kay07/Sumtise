# Sumtise User Acceptance Testing (UAT) Checklist

## Pre-UAT Setup

- [ ] Database seeded with Demo Org (`npm run uat:init`)
- [ ] All environment variables configured
- [ ] Application running in test environment
- [ ] Test users created and verified
- [ ] Test data verified (customers, invoices, bills, etc.)

## Test Credentials

**Admin User:**
- Email: `admin@sumtise.com`
- Organization: `Demo Org` (slug: `demo-org`)

---

## 1. Authentication & Organization Selection

### 1.1 Sign In
- [ ] Can sign in with valid credentials
- [ ] Invalid credentials show error message
- [ ] Password field is masked
- [ ] "Remember me" option works (if implemented)
- [ ] Forgot password flow works (if implemented)

### 1.2 Organization Selection
- [ ] Organization selection screen appears after sign in
- [ ] User can select from available organizations
- [ ] User can only see organizations they belong to
- [ ] Selected organization persists in session
- [ ] Can switch organizations (if multiple available)

### 1.3 Sign Out
- [ ] Sign out button works
- [ ] Session is cleared on sign out
- [ ] User is redirected to sign in page
- [ ] Cannot access protected routes after sign out

---

## 2. Dashboard

### 2.1 Dashboard Loads
- [ ] Dashboard loads without errors
- [ ] All summary cards display correctly
- [ ] Charts/graphs render properly
- [ ] Data is accurate and current

### 2.2 Dashboard Metrics
- [ ] Total Revenue displays correctly
- [ ] Total Expenses displays correctly
- [ ] Net Profit calculates correctly
- [ ] Cash Position shows correct balances
- [ ] Outstanding Invoices count is accurate
- [ ] Overdue Invoices count is accurate

### 2.3 Dashboard Interactivity
- [ ] Date range filters work (if implemented)
- [ ] Chart interactions work (hover, zoom, etc.)
- [ ] Links to detailed views work
- [ ] Refresh data button works (if implemented)

---

## 3. Invoices Module

### 3.1 View Invoices
- [ ] Invoices list loads with data
- [ ] All invoices display correct information
- [ ] Invoice status badges display correctly
- [ ] Customer names are shown
- [ ] Amounts display with correct currency formatting
- [ ] Dates display in correct format (dd-mm-yyyy)

### 3.2 Invoice Search & Filter
- [ ] Search by invoice number works
- [ ] Search by customer name works
- [ ] Status filter works (All, Draft, Sent, Paid, Overdue)
- [ ] Combined search and filter work together
- [ ] Search is debounced (no lag when typing)
- [ ] Results update in real-time

### 3.3 Create Invoice
- [ ] "Create Invoice" button navigates correctly
- [ ] Form loads with all required fields
- [ ] Customer dropdown populates
- [ ] Date picker works (dd-mm-yyyy format)
- [ ] Can add multiple line items
- [ ] Line item calculations work (quantity × price)
- [ ] Tax calculations are correct
- [ ] Total amount calculates correctly
- [ ] Can save as draft
- [ ] Can send invoice
- [ ] Invoice number auto-generates correctly

### 3.4 View Invoice Details
- [ ] Can click invoice to view details
- [ ] All invoice information displays correctly
- [ ] Line items show correctly
- [ ] Totals are accurate
- [ ] Invoice PDF can be downloaded (if implemented)
- [ ] Invoice can be emailed (if implemented)

### 3.5 Credit Notes
- [ ] Can create credit note from invoice
- [ ] Credit note form works correctly
- [ ] Credit note is linked to original invoice
- [ ] Credit note amounts are correct
- [ ] Credit note appears in invoices list

### 3.6 Send Reminders
- [ ] Can view overdue invoices
- [ ] Can select invoices for reminder
- [ ] Can send reminder emails
- [ ] Reminder confirmation message appears
- [ ] Reminders are logged (if implemented)

---

## 4. Expenses Module

### 4.1 View Expenses
- [ ] Expenses list loads with data
- [ ] All expenses display correct information
- [ ] Expense categories display correctly
- [ ] Amounts display correctly
- [ ] Dates display in correct format
- [ ] Receipt attachments show (if implemented)

### 4.2 Create Expense
- [ ] "Create Expense" button works
- [ ] Form loads with all fields
- [ ] Can upload receipt image
- [ ] OCR scanning works (if implemented)
- [ ] AI categorization works (if implemented)
- [ ] Can manually enter expense details
- [ ] Amount validation works
- [ ] Category selection works
- [ ] Date picker works
- [ ] Can save expense

### 4.3 Amend Expense
- [ ] Can amend existing expense
- [ ] Audit trail is created
- [ ] Previous version is preserved
- [ ] Changes are tracked
- [ ] Approval workflow works (if implemented)

### 4.4 Debit Notes
- [ ] Can create debit note
- [ ] Debit note form works
- [ ] Debit note is linked to bill
- [ ] Amounts are correct

### 4.5 Payment Run
- [ ] Payment Run page loads
- [ ] Outstanding bills are displayed
- [ ] Can select bills for payment
- [ ] Payment date selector works
- [ ] Payment method selector works
- [ ] Summary calculations are correct
- [ ] Can process payment run
- [ ] Payment file can be exported (if implemented)
- [ ] Selected bills are marked as paid
- [ ] Payment history is recorded

---

## 5. Banking Module

### 5.1 Bank Accounts
- [ ] Bank accounts list displays
- [ ] Account balances are shown
- [ ] Account details are correct
- [ ] Currency displays correctly

### 5.2 Bank Reconciliation
- [ ] Reconciliation page loads
- [ ] Can import bank statement
- [ ] Transactions are matched correctly
- [ ] Unmatched transactions are shown
- [ ] Can manually match transactions
- [ ] Reconciliation can be completed
- [ ] Reconciliation status is tracked

### 5.3 Transactions
- [ ] Bank transactions are displayed
- [ ] Transaction details are correct
- [ ] Can filter transactions
- [ ] Can search transactions
- [ ] Transaction categories are shown

---

## 6. Reporting Module

### 6.1 Profit & Loss Report
- [ ] Report loads correctly
- [ ] Revenue totals are correct
- [ ] Expense totals are correct
- [ ] Net profit/loss calculates correctly
- [ ] Date range filter works
- [ ] Report can be exported (if implemented)

### 6.2 Balance Sheet
- [ ] Report loads correctly
- [ ] Assets are calculated correctly
- [ ] Liabilities are calculated correctly
- [ ] Equity is calculated correctly
- [ ] Balance sheet balances (Assets = Liabilities + Equity)
- [ ] Date range filter works

### 6.3 Cash Flow Statement
- [ ] Report loads correctly
- [ ] Operating activities are shown
- [ ] Investing activities are shown
- [ ] Financing activities are shown
- [ ] Net cash flow is calculated correctly

### 6.4 Aged Receivables
- [ ] Report shows outstanding invoices
- [ ] Age buckets are correct (0-30, 31-60, 61-90, 90+)
- [ ] Totals are accurate
- [ ] Can drill down to invoice details

### 6.5 Expense Reports
- [ ] Expense by category shows correctly
- [ ] Pie chart renders (if implemented)
- [ ] Percentages are calculated correctly
- [ ] Can filter by date range

---

## 7. Chart of Accounts

### 7.1 View Chart of Accounts
- [ ] Chart of accounts displays
- [ ] Account hierarchy is shown correctly
- [ ] Account codes are displayed
- [ ] Account types are correct
- [ ] Can expand/collapse categories

### 7.2 Create Account
- [ ] Can create new account
- [ ] Account code is validated
- [ ] Parent account selection works
- [ ] Account type selection works
- [ ] Account is saved correctly

### 7.3 Edit Account
- [ ] Can edit account details
- [ ] Changes are saved
- [ ] Cannot change account type if used in transactions

---

## 8. Contacts Module

### 8.1 Customers
- [ ] Customers list displays
- [ ] Can create new customer
- [ ] Can edit customer
- [ ] Can view customer details
- [ ] Customer credit limit is shown
- [ ] Outstanding invoices for customer are shown

### 8.2 Vendors
- [ ] Vendors list displays
- [ ] Can create new vendor
- [ ] Can edit vendor
- [ ] Can view vendor details
- [ ] Bank details are stored correctly

---

## 9. Settings

### 9.1 Organisation Settings
- [ ] Settings page loads
- [ ] Default currency is set (GBP)
- [ ] Date format is set (dd-mm-yyyy)
- [ ] Year-end start date is configured
- [ ] VAT/Sales tax settings work
- [ ] Can save settings
- [ ] Settings persist after save

### 9.2 Accounting Settings
- [ ] Chart of accounts template is set
- [ ] Auto-numbering settings work
- [ ] Approval thresholds are configured
- [ ] Audit trail is enabled

### 9.3 Invoicing Settings
- [ ] Payment terms default correctly
- [ ] Invoice template is selected
- [ ] Auto-reminder settings work
- [ ] Payment link settings work

---

## 10. Security & Access Control

### 10.1 Organization Scoping
- [ ] Users can only see their organization's data
- [ ] Cannot access other organizations' data via API
- [ ] Organization selection is enforced
- [ ] Cross-organization access attempts are blocked

### 10.2 Resource Ownership
- [ ] Cannot update resources from other organizations
- [ ] Cannot delete resources from other organizations
- [ ] Resource ownership is verified server-side
- [ ] Appropriate error messages shown for unauthorized access

### 10.3 Authentication
- [ ] Session expires after inactivity (if configured)
- [ ] Secure password requirements (if implemented)
- [ ] Two-factor authentication works (if implemented)

---

## 11. Performance & Optimization

### 11.1 Page Load Performance
- [ ] Dashboard loads in < 3 seconds
- [ ] Invoices list loads in < 2 seconds
- [ ] Expenses list loads in < 2 seconds
- [ ] Reports load in < 5 seconds
- [ ] No unnecessary API calls

### 11.2 Search Performance
- [ ] Search is debounced (300ms)
- [ ] Search results appear quickly
- [ ] No lag when typing

### 11.3 Large Data Sets
- [ ] Handles 100+ invoices without slowdown
- [ ] Handles 100+ expenses without slowdown
- [ ] Pagination works correctly
- [ ] Virtual scrolling works (if implemented)

---

## 12. Responsive Design

### 12.1 Desktop (1920x1080)
- [ ] All pages display correctly
- [ ] Navigation is accessible
- [ ] Tables are readable
- [ ] Forms are usable

### 12.2 Tablet (768x1024)
- [ ] Layout adapts correctly
- [ ] Navigation is accessible
- [ ] Tables are scrollable
- [ ] Forms are usable

### 12.3 Mobile (375x667)
- [ ] Layout adapts correctly
- [ ] Navigation menu works
- [ ] Tables are scrollable
- [ ] Forms are usable
- [ ] Touch targets are adequate

---

## 13. Browser Compatibility

- [ ] Chrome (latest) - All features work
- [ ] Firefox (latest) - All features work
- [ ] Safari (latest) - All features work
- [ ] Edge (latest) - All features work

---

## 14. Error Handling

### 14.1 Network Errors
- [ ] Graceful handling of network failures
- [ ] Error messages are user-friendly
- [ ] Retry options are provided (if applicable)

### 14.2 Validation Errors
- [ ] Form validation errors are clear
- [ ] Field-level errors are shown
- [ ] Error messages are helpful

### 14.3 Server Errors
- [ ] 500 errors show appropriate message
- [ ] 404 errors show appropriate message
- [ ] 403 errors show appropriate message
- [ ] Error logging works (if implemented)

---

## 15. Data Integrity

### 15.1 Data Accuracy
- [ ] Invoice totals are correct
- [ ] Expense totals are correct
- [ ] Account balances are correct
- [ ] Trial balance balances (debits = credits)

### 15.2 Data Consistency
- [ ] Cannot delete account used in transactions
- [ ] Cannot delete customer with invoices
- [ ] Cannot delete vendor with bills
- [ ] Audit trail is maintained

---

## 16. Integration Tests

### 16.1 End-to-End Flows
- [ ] Create invoice → Send → Receive payment → Record in banking
- [ ] Create expense → Approve → Process payment run
- [ ] Import bank statement → Match transactions → Reconcile
- [ ] Create customer → Create invoice → Send reminder → Receive payment

---

## 17. UAT Completion Sign-off

**Tested By:**
- Name: _______________________
- Date: _______________________
- Environment: _______________________

**Sign-off:**

- [ ] All critical paths tested
- [ ] All major features working
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Ready for production

**Known Issues:**
[List any issues found during testing]

**Approval:**

- [ ] Approved for Production
- [ ] Requires Fixes Before Production
- [ ] Rejected - Major Issues Found

**Approved By:**
- Name: _______________________
- Date: _______________________
- Signature: _______________________

---

## Test Data Verification

After running `npm run uat:init`, verify:
- [ ] Demo Org exists
- [ ] 4+ customers created
- [ ] 3+ vendors created
- [ ] 4+ invoices created
- [ ] 3+ bills created
- [ ] 1+ payment created
- [ ] 2+ bank accounts created
- [ ] 15+ chart of accounts created
- [ ] 4+ transactions created
- [ ] Organization settings configured

---

## Regression Testing Checklist

Before final sign-off, test:
- [ ] No functionality broken from previous releases
- [ ] All existing features still work
- [ ] Performance has not degraded
- [ ] No new bugs introduced

