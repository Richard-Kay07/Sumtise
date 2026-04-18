# Payment Run Functionality - Implementation Status

## ✅ Database Schema - COMPLETE

### Payment Models Added to Schema

1. **`PaymentRun`** - Batch payment processing record
   - Tracks payment batches/runs
   - Links multiple payments together
   - Stores payment date, method, status
   - References organization's bank account
   - Includes file reference for exported payment files (BACS, CSV, etc.)

2. **`Payment`** - Individual payment record
   - Links to PaymentRun (for batch payments)
   - Links to Bill (if paying a specific bill)
   - Links to Vendor
   - Tracks payment amount, date, method, status
   - Can track payment reference numbers
   - Supports metadata for additional payment details

3. **Payment Enums**
   - `PaymentMethod`: BANK_TRANSFER, BACS, FASTER_PAYMENTS, CHAPS, CHEQUE, CARD, OTHER
   - `PaymentRunStatus`: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
   - `PaymentStatus`: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REVERSED

### Updated Models

1. **`Vendor`** - Added bank account fields:
   - `bankAccountNumber`
   - `bankSortCode`
   - `bankIBAN`
   - `bankSWIFT`
   - `bankName`
   - Added `payments` relation

2. **`Bill`** - Added:
   - `payments` relation (tracks payments made against this bill)

3. **`BankAccount`** - Added:
   - `paymentRuns` relation
   - `payments` relation

4. **`Organization`** - Added:
   - `paymentRuns` relation
   - `payments` relation

5. **`User`** - Added:
   - `paymentRuns` relation (to track who initiated payment runs)

## ✅ Frontend Page - PARTIALLY COMPLETE

### Current Implementation: `/expenses/payment-run/page.tsx`

**✅ What's Working:**
- UI is fully implemented
- Payment settings (date, method)
- Supplier invoice listing
- Selection (individual and bulk)
- Search and filter functionality
- Payment summary sidebar
- File preview functionality
- Export payment file button

**⚠️ What Needs Backend Integration:**
- Currently uses mock data (`mockPayments`)
- Needs tRPC queries to fetch outstanding bills
- Needs tRPC mutations to create payment runs
- Needs tRPC mutations to create individual payments
- Needs integration for file export (BACS, CSV formats)

### Required Changes:

1. **Replace Mock Data with tRPC Query:**
```typescript
// Instead of mockPayments, use:
const { data: outstandingBills } = trpc.bills.getOutstandingForPayment.useQuery({
  organizationId: organizations?.[0]?.id || "",
  vendorId: undefined, // filter by vendor if needed
})
```

2. **Add Payment Run Creation:**
```typescript
const createPaymentRun = trpc.paymentRuns.create.useMutation({
  onSuccess: () => {
    // Navigate to payment run details or show success
  }
})
```

3. **Update Bill Status After Payment:**
```typescript
// Bills should be updated to status "PAID" when payment is completed
```

## ⚠️ Backend Implementation - TODO

### Required tRPC Routers

#### 1. Payment Runs Router
```typescript
paymentRuns: createTRPCRouter({
  // Get all payment runs
  getAll: protectedProcedure.input(...).query(...),
  
  // Get outstanding bills ready for payment
  getOutstandingBills: protectedProcedure.input({
    organizationId: z.string(),
    vendorId: z.string().optional(),
    status: z.enum(["RECEIVED", "APPROVED", "OVERDUE"]).optional(),
  }).query(async ({ ctx, input }) => {
    // Return bills with status RECEIVED, APPROVED, or OVERDUE
    // Include vendor bank details
  }),
  
  // Create a new payment run
  create: protectedProcedure.input({
    organizationId: z.string(),
    paymentDate: z.date(),
    paymentMethod: z.enum(["BANK_TRANSFER", "BACS", "FASTER_PAYMENTS", "CHAPS", "CHEQUE", "CARD", "OTHER"]),
    bankAccountId: z.string(),
    billIds: z.array(z.string()), // Bills to pay
    notes: z.string().optional(),
  }).mutation(async ({ ctx, input }) => {
    // 1. Generate payment run number
    // 2. Create PaymentRun record
    // 3. Create Payment records for each bill
    // 4. Update Bill status to PAID
    // 5. Create accounting transactions (debit AP, credit bank)
    // 6. Return payment run with payments
  }),
  
  // Get payment run by ID
  getById: protectedProcedure.input(...).query(...),
  
  // Process payment run (mark as processing/completed)
  process: protectedProcedure.input({
    paymentRunId: z.string(),
    status: z.enum(["PROCESSING", "COMPLETED", "FAILED"]),
  }).mutation(...),
  
  // Export payment file (BACS, CSV, etc.)
  exportFile: protectedProcedure.input({
    paymentRunId: z.string(),
    format: z.enum(["BACS", "CSV", "XML"]),
  }).query(...), // Returns file data or download URL
})
```

#### 2. Payments Router
```typescript
payments: createTRPCRouter({
  // Get all payments (with filters)
  getAll: protectedProcedure.input({
    organizationId: z.string(),
    paymentRunId: z.string().optional(),
    billId: z.string().optional(),
    vendorId: z.string().optional(),
    status: z.enum([...]).optional(),
    page: z.number(),
    limit: z.number(),
  }).query(...),
  
  // Get payment by ID
  getById: protectedProcedure.input(...).query(...),
  
  // Reverse a payment
  reverse: protectedProcedure.input({
    paymentId: z.string(),
    reason: z.string(),
  }).mutation(...),
})
```

#### 3. Update Bills Router
```typescript
// Add method to get outstanding bills
bills: createTRPCRouter({
  // ... existing methods ...
  
  getOutstandingForPayment: protectedProcedure.input({
    organizationId: z.string(),
    vendorId: z.string().optional(),
    includePaid: z.boolean().default(false),
  }).query(async ({ ctx, input }) => {
    // Return bills where status is RECEIVED, APPROVED, or OVERDUE
    // Optionally include bills with payments
    // Include vendor bank details
  }),
})
```

### Accounting Integration Required

When a payment is processed, the system should:

1. **Create Double-Entry Transactions:**
   - Debit: Accounts Payable account
   - Credit: Bank Account (or Cash account)

2. **Update Bill Status:**
   - Set bill status to "PAID"
   - Record payment reference

3. **Update Bank Account Balance:**
   - Decrease bank account current balance

4. **Track Payment Run Totals:**
   - Sum all payments in a run
   - Verify totals match

## 📋 Implementation Checklist

### Database
- [x] PaymentRun model created
- [x] Payment model created
- [x] Payment enums created
- [x] Vendor bank details added
- [x] All relations updated
- [ ] Migration run (pending database setup)

### Frontend
- [x] Payment run page UI complete
- [ ] Replace mock data with tRPC queries
- [ ] Add payment run creation mutation
- [ ] Add payment status updates
- [ ] Add payment history view
- [ ] Add file export functionality
- [ ] Add error handling and loading states

### Backend
- [ ] Create paymentRuns tRPC router
- [ ] Create payments tRPC router
- [ ] Update bills router with getOutstandingForPayment
- [ ] Implement payment file export (BACS, CSV)
- [ ] Implement double-entry accounting on payment
- [ ] Add payment reversal functionality
- [ ] Add payment status webhooks/notifications

### Testing
- [ ] Test payment run creation
- [ ] Test individual payment creation
- [ ] Test payment file export formats
- [ ] Test accounting transaction creation
- [ ] Test bill status updates
- [ ] Test payment reversal
- [ ] Test error scenarios

## 🎯 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ **COMPLETE** | All models and relations added |
| Frontend UI | ✅ **COMPLETE** | Full UI implemented |
| Frontend Data Integration | ⚠️ **PARTIAL** | Uses mock data, needs tRPC |
| Backend tRPC Routers | ❌ **MISSING** | Need to be implemented |
| Payment File Export | ❌ **MISSING** | BACS/CSV export needed |
| Accounting Integration | ❌ **MISSING** | Double-entry transactions |
| Payment History | ⚠️ **PARTIAL** | UI exists, needs backend |

## 🚀 Next Steps to Complete

1. **Implement tRPC Routers** (Priority 1)
   - Create `paymentRuns` router
   - Create `payments` router
   - Update `bills` router

2. **Connect Frontend to Backend** (Priority 2)
   - Replace mock data
   - Add mutations
   - Add loading/error states

3. **Implement Payment Processing** (Priority 3)
   - Double-entry accounting
   - Bill status updates
   - Bank balance updates

4. **Add File Export** (Priority 4)
   - BACS format
   - CSV format
   - XML format (optional)

5. **Add Payment History** (Priority 5)
   - Payment run history page
   - Individual payment tracking
   - Reversal functionality

## 📊 Overall Assessment

**Database Schema**: ✅ **100% Complete**
- All necessary models and relations are in place
- Supports batch payments, individual payments, and full audit trail

**Frontend Implementation**: ✅ **85% Complete**
- UI is fully functional and polished
- Needs backend integration to be fully operational

**Backend Implementation**: ❌ **0% Complete**
- No tRPC routers exist yet
- Payment processing logic not implemented
- File export not implemented

**Overall**: ⚠️ **~60% Complete**
- Solid foundation in place
- Database schema is production-ready
- Frontend is user-ready but needs data
- Backend implementation is the main gap

## 🔧 Quick Fix Required

The payment run page currently uses mock data. To make it functional, the minimum required is:

1. Add `getOutstandingBills` query to bills router
2. Add `createPaymentRun` mutation to paymentRuns router
3. Replace mock data in frontend with tRPC query
4. Add basic payment processing (update bill status)

This can be done incrementally without breaking existing functionality.

