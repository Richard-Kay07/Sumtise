# Schema Updates Required for Core Standards

**Date:** January 2024  
**Purpose:** Track required schema updates to align with core standards

---

## Soft Delete Pattern

### Current State

Some models use `isActive: Boolean` instead of `deletedAt: DateTime?`:
- ✅ `ChartOfAccount` - uses `isActive`
- ✅ `Customer` - uses `isActive`
- ✅ `Vendor` - uses `isActive`
- ✅ `BankAccount` - uses `isActive`

### Recommendation

**Option 1: Keep `isActive` (Recommended)**
- Already implemented and working
- Simpler boolean check
- Update standards to support both patterns

**Option 2: Migrate to `deletedAt`**
- More standard soft-delete pattern
- Allows recovery of deleted records
- Requires migration

**Decision:** Keep `isActive` for existing models, use `deletedAt` for new models.

---

## Missing `deletedAt` Fields

### Models That Need `deletedAt`

The following models should have `deletedAt` added for soft delete:

1. **Invoice** - Currently uses status-based deletion (CANCELLED)
2. **Bill** - Currently uses status-based deletion (CANCELLED)
3. **CreditNote** - Currently uses status-based deletion (CANCELLED)
4. **DebitNote** - Currently uses status-based deletion (CANCELLED)
5. **Transaction** - No deletion mechanism
6. **Payment** - No deletion mechanism
7. **PaymentRun** - No deletion mechanism

### Migration Plan

```prisma
// Add to existing models
model Invoice {
  // ... existing fields
  deletedAt DateTime?
  
  @@index([organizationId, deletedAt])
}

model Bill {
  // ... existing fields
  deletedAt DateTime?
  
  @@index([organizationId, deletedAt])
}

// ... etc
```

---

## Idempotency Key Model

### Required Model

```prisma
model IdempotencyKey {
  id        String   @id @default(cuid())
  key       String   @unique
  operation String   // e.g., "createInvoice", "processPayment"
  result    Json?    // Cached result
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([key])
  @@map("idempotency_keys")
}
```

**Status:** ❌ Not yet implemented

---

## Database Indexes

### Required Indexes for Performance

Add indexes for common query patterns:

```prisma
// Organization + soft delete
@@index([organizationId, deletedAt])
@@index([organizationId, isActive])

// Organization + status
@@index([organizationId, status])

// Organization + date
@@index([organizationId, date])

// Organization + status + date (for reports)
@@index([organizationId, status, date])
```

### Current Index Status

Review each model and add indexes based on:
- Common filter combinations
- Sort fields
- Foreign key lookups

---

## Date Fields

### Current State

✅ All date fields use `DateTime` (UTC) - Correct

### Verification Needed

Ensure all date fields:
- Use `DateTime` type (not `String`)
- Default to `now()` for `createdAt`
- Use `@updatedAt` for `updatedAt`
- Are stored in UTC

---

## Summary

### Immediate Actions

1. ✅ **Keep `isActive` pattern** for existing models
2. ⚠️ **Add `deletedAt`** to models that need soft delete
3. ⚠️ **Add IdempotencyKey model** for mutating operations
4. ⚠️ **Add database indexes** for performance
5. ✅ **Verify date fields** are using DateTime

### Migration Priority

1. **High:** Add IdempotencyKey model (needed for payment processing)
2. **Medium:** Add `deletedAt` to Invoice, Bill, CreditNote, DebitNote
3. **Low:** Add indexes (can be done incrementally)

---

**Note:** These updates should be done as part of Phase 1 implementation, before building new routers.

