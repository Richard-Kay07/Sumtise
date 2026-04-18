# Permissions & Role-Based Access Control Guide

**Version:** 1.0  
**Last Updated:** January 2024

---

## Overview

The Sumtise application uses a role-based access control (RBAC) system with 5 roles and granular permissions. All organization-scoped operations require permission checks.

---

## Roles

### 1. OWNER
- **Full access** to all features
- Can delete organization
- Can manage all members
- All permissions granted

### 2. ADMIN
- **Full access** except organization deletion
- Can manage members
- Can configure all settings
- Can perform all operations

### 3. ACCOUNTANT (Finance)
- **Financial operations** access
- Can create/edit transactions, invoices, bills, payments
- Can approve bills
- Can process payment runs
- Can view/edit chart of accounts
- Cannot delete critical records
- Cannot manage members

### 4. BOOKKEEPER
- **Data entry** access
- Can create invoices, bills, transactions
- Can create customers/vendors
- Cannot approve bills
- Cannot process payments
- Cannot delete records
- View-only for reports and settings

### 5. VIEWER
- **Read-only** access
- Can view all data
- Cannot create, edit, or delete anything
- Cannot export reports

---

## Permission Matrix

| Permission | OWNER | ADMIN | ACCOUNTANT | BOOKKEEPER | VIEWER |
|------------|-------|-------|------------|------------|--------|
| **Organization** | | | | | |
| ORGANIZATION_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ |
| ORGANIZATION_EDIT | ✅ | ✅ | ❌ | ❌ | ❌ |
| ORGANIZATION_DELETE | ✅ | ❌ | ❌ | ❌ | ❌ |
| ORGANIZATION_SETTINGS | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Members** | | | | | |
| MEMBERS_VIEW | ✅ | ✅ | ❌ | ❌ | ❌ |
| MEMBERS_INVITE | ✅ | ✅ | ❌ | ❌ | ❌ |
| MEMBERS_EDIT | ✅ | ✅ | ❌ | ❌ | ❌ |
| MEMBERS_REMOVE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Invoices** | | | | | |
| INVOICES_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ |
| INVOICES_CREATE | ✅ | ✅ | ✅ | ✅ | ❌ |
| INVOICES_EDIT | ✅ | ✅ | ✅ | ✅ | ❌ |
| INVOICES_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| INVOICES_SEND | ✅ | ✅ | ✅ | ❌ | ❌ |
| INVOICES_MARK_PAID | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Bills** | | | | | |
| BILLS_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ |
| BILLS_CREATE | ✅ | ✅ | ✅ | ✅ | ❌ |
| BILLS_EDIT | ✅ | ✅ | ✅ | ✅ | ❌ |
| BILLS_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| BILLS_APPROVE | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Payments** | | | | | |
| PAYMENTS_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ |
| PAYMENTS_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ |
| PAYMENTS_EDIT | ✅ | ✅ | ✅ | ❌ | ❌ |
| PAYMENTS_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| PAYMENTS_PROCESS | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Payment Runs** | | | | | |
| PAYMENT_RUNS_VIEW | ✅ | ✅ | ✅ | ❌ | ✅ |
| PAYMENT_RUNS_CREATE | ✅ | ✅ | ✅ | ❌ | ❌ |
| PAYMENT_RUNS_PROCESS | ✅ | ✅ | ✅ | ❌ | ❌ |
| PAYMENT_RUNS_DELETE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Reports** | | | | | |
| REPORTS_VIEW | ✅ | ✅ | ✅ | ✅ | ✅ |
| REPORTS_EXPORT | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## Implementation Guide

### Step 1: Import Permissions

```typescript
import { Permission, requirePermissionProcedure, requireAnyPermissionProcedure } from "@/lib/trpc"
```

### Step 2: Apply to Routers

#### Example: Invoices Router

```typescript
export const invoicesRouter = createTRPCRouter({
  // View - requires VIEW permission
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({ organizationId: z.string(), ...paginationSchema.shape }))
    .query(async ({ ctx, input }) => {
      // ... implementation
    }),

  // Create - requires CREATE permission
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(createInvoiceSchema)
    .mutation(async ({ ctx, input }) => {
      // ... implementation
    }),

  // Update - requires EDIT permission
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
    .input(z.object({ id: z.string(), organizationId: z.string(), data: updateInvoiceSchema }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      // ... implementation
    }),

  // Delete - requires DELETE permission
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_DELETE))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      // ... implementation
    }),

  // Send - requires SEND permission
  send: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... implementation
    }),

  // Mark Paid - requires MARK_PAID permission
  markAsPaid: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_MARK_PAID))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... implementation
    }),
})
```

#### Example: Multiple Permissions (Any)

```typescript
// Allow if user has either EDIT or DELETE permission
updateOrDelete: orgScopedProcedure
  .use(requireAnyPermissionProcedure([
    Permission.INVOICES_EDIT,
    Permission.INVOICES_DELETE,
  ]))
  .mutation(async ({ ctx, input }) => {
    // ... implementation
  }),
```

### Step 3: Permission Mapping by Router

#### Chart of Accounts Router
- `getAll` → `Permission.CHART_OF_ACCOUNTS_VIEW`
- `create` → `Permission.CHART_OF_ACCOUNTS_CREATE`
- `update` → `Permission.CHART_OF_ACCOUNTS_EDIT`
- `delete` → `Permission.CHART_OF_ACCOUNTS_DELETE`

#### Transactions Router
- `getAll` → `Permission.TRANSACTIONS_VIEW`
- `create` → `Permission.TRANSACTIONS_CREATE`
- `update` → `Permission.TRANSACTIONS_EDIT`
- `delete` → `Permission.TRANSACTIONS_DELETE`

#### Customers Router
- `getAll` → `Permission.CUSTOMERS_VIEW`
- `create` → `Permission.CUSTOMERS_CREATE`
- `update` → `Permission.CUSTOMERS_EDIT`
- `delete` → `Permission.CUSTOMERS_DELETE`

#### Vendors Router (to be created)
- `getAll` → `Permission.VENDORS_VIEW`
- `create` → `Permission.VENDORS_CREATE`
- `update` → `Permission.VENDORS_EDIT`
- `delete` → `Permission.VENDORS_DELETE`

#### Bills Router (to be created)
- `getAll` → `Permission.BILLS_VIEW`
- `create` → `Permission.BILLS_CREATE`
- `update` → `Permission.BILLS_EDIT`
- `delete` → `Permission.BILLS_DELETE`
- `approve` → `Permission.BILLS_APPROVE`

#### Credit Notes Router (to be created)
- `getAll` → `Permission.CREDIT_NOTES_VIEW`
- `create` → `Permission.CREDIT_NOTES_CREATE`
- `update` → `Permission.CREDIT_NOTES_EDIT`
- `delete` → `Permission.CREDIT_NOTES_DELETE`

#### Debit Notes Router (to be created)
- `getAll` → `Permission.DEBIT_NOTES_VIEW`
- `create` → `Permission.DEBIT_NOTES_CREATE`
- `update` → `Permission.DEBIT_NOTES_EDIT`
- `delete` → `Permission.DEBIT_NOTES_DELETE`

#### Payments Router (to be created)
- `getAll` → `Permission.PAYMENTS_VIEW`
- `create` → `Permission.PAYMENTS_CREATE`
- `update` → `Permission.PAYMENTS_EDIT`
- `delete` → `Permission.PAYMENTS_DELETE`
- `process` → `Permission.PAYMENTS_PROCESS`

#### Payment Runs Router (to be created)
- `getAll` → `Permission.PAYMENT_RUNS_VIEW`
- `create` → `Permission.PAYMENT_RUNS_CREATE`
- `process` → `Permission.PAYMENT_RUNS_PROCESS`
- `delete` → `Permission.PAYMENT_RUNS_DELETE`

#### Bank Accounts Router
- `getAll` → `Permission.BANK_ACCOUNTS_VIEW`
- `create` → `Permission.BANK_ACCOUNTS_CREATE`
- `update` → `Permission.BANK_ACCOUNTS_EDIT`
- `delete` → `Permission.BANK_ACCOUNTS_DELETE`
- `reconcile` → `Permission.BANK_ACCOUNTS_RECONCILE`

#### Reports Router
- `getAll` → `Permission.REPORTS_VIEW`
- `export` → `Permission.REPORTS_EXPORT`

---

## Router Update Checklist

### Existing Routers to Update

- [ ] **chartOfAccounts** router
  - [ ] Add `Permission.CHART_OF_ACCOUNTS_VIEW` to `getAll`
  - [ ] Add `Permission.CHART_OF_ACCOUNTS_CREATE` to `create`
  - [ ] Add `Permission.CHART_OF_ACCOUNTS_EDIT` to `update`
  - [ ] Add `Permission.CHART_OF_ACCOUNTS_DELETE` to `delete`

- [ ] **transactions** router
  - [ ] Add `Permission.TRANSACTIONS_VIEW` to `getAll`
  - [ ] Add `Permission.TRANSACTIONS_CREATE` to `create`
  - [ ] Add `Permission.TRANSACTIONS_CREATE` to `createDoubleEntry`
  - [ ] Add `Permission.TRANSACTIONS_EDIT` to `update` (if exists)
  - [ ] Add `Permission.TRANSACTIONS_DELETE` to `delete` (if exists)

- [ ] **customers** router
  - [ ] Add `Permission.CUSTOMERS_VIEW` to `getAll`
  - [ ] Add `Permission.CUSTOMERS_CREATE` to `create`
  - [ ] Add `Permission.CUSTOMERS_EDIT` to `update`
  - [ ] Add `Permission.CUSTOMERS_DELETE` to `delete`

- [ ] **invoices** router
  - [ ] Add `Permission.INVOICES_VIEW` to `getAll`
  - [ ] Add `Permission.INVOICES_CREATE` to `create`
  - [ ] Add `Permission.INVOICES_EDIT` to `update`
  - [ ] Add `Permission.INVOICES_DELETE` to `delete`
  - [ ] Add `Permission.INVOICES_SEND` to `send` (when implemented)
  - [ ] Add `Permission.INVOICES_MARK_PAID` to `markAsPaid` (when implemented)

- [ ] **bankAccounts** router
  - [ ] Add `Permission.BANK_ACCOUNTS_VIEW` to `getAll`
  - [ ] Add `Permission.BANK_ACCOUNTS_CREATE` to `create`
  - [ ] Add `Permission.BANK_ACCOUNTS_EDIT` to `update`
  - [ ] Add `Permission.BANK_ACCOUNTS_DELETE` to `delete`
  - [ ] Add `Permission.BANK_ACCOUNTS_RECONCILE` to `reconcile` (when implemented)

- [ ] **dashboard** router
  - [ ] Add `Permission.ORGANIZATION_VIEW` to `getStats` (or appropriate permission)

### New Routers to Create with Permissions

- [ ] **vendors** router (NEW)
- [ ] **bills** router (NEW)
- [ ] **creditNotes** router (NEW)
- [ ] **debitNotes** router (NEW)
- [ ] **payments** router (NEW)
- [ ] **paymentRuns** router (NEW)
- [ ] **invoiceReminders** router (NEW)
- [ ] **billAmendments** router (NEW)

---

## Example: Complete Router with Permissions

```typescript
import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { paginationSchema } from "@/types/schemas"

export const invoicesRouter = createTRPCRouter({
  // View all invoices
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string(),
      ...paginationSchema.shape,
      status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      }
      
      if (input.status) {
        where.status = input.status
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: { customer: true, items: true },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
        prisma.invoice.count({ where }),
      ])

      return {
        invoices,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      }
    }),

  // Create invoice
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(createInvoiceSchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // ... create logic
    }),

  // Update invoice
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
      data: updateInvoiceSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      // ... update logic
    }),

  // Delete invoice
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_DELETE))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      // ... delete logic (soft delete)
    }),

  // Send invoice
  send: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      // ... send logic
    }),

  // Mark as paid
  markAsPaid: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_MARK_PAID))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      // ... mark as paid logic
    }),
})
```

---

## Testing Permissions

### Test Cases

1. **Owner** should have access to all endpoints
2. **Admin** should have access to all except organization delete
3. **Accountant** should have access to financial operations
4. **Bookkeeper** should have access to data entry only
5. **Viewer** should have read-only access

### Test Example

```typescript
// Test that viewer cannot create invoice
const viewerContext = {
  session: { user: { id: viewerUserId } },
  organizationId: orgId,
  role: UserRole.VIEWER,
}

// Should throw FORBIDDEN error
await expect(
  invoicesRouter.create.mutate({
    organizationId: orgId,
    // ... invoice data
  })
).rejects.toThrow("FORBIDDEN")
```

---

## Best Practices

1. **Always use `orgScopedProcedure`** for organization-scoped operations
2. **Add permission checks** using `.use(requirePermissionProcedure(...))`
3. **Verify resource ownership** for update/delete operations
4. **Use specific permissions** (e.g., `INVOICES_SEND` not `INVOICES_EDIT`)
5. **Check permissions early** in the middleware chain
6. **Provide clear error messages** when permission denied

---

## Migration Plan

### Phase 1: Update Existing Routers
1. Update `chartOfAccounts` router
2. Update `transactions` router
3. Update `customers` router
4. Update `invoices` router
5. Update `bankAccounts` router
6. Update `dashboard` router

### Phase 2: Add to New Routers
1. Add permissions to `vendors` router (when created)
2. Add permissions to `bills` router (when created)
3. Add permissions to `creditNotes` router (when created)
4. Add permissions to `debitNotes` router (when created)
5. Add permissions to `payments` router (when created)
6. Add permissions to `paymentRuns` router (when created)

---

## Summary

- ✅ Permissions system created
- ✅ Role matrix defined
- ✅ Permission middleware created
- ✅ Organization guards enhanced with role
- ⚠️ **TODO:** Apply permissions to all existing routers
- ⚠️ **TODO:** Apply permissions to all new routers

**Next Steps:**
1. Update all existing routers with permission checks
2. Ensure all new routers include permission checks
3. Test permission enforcement
4. Update frontend to hide/disable UI based on permissions

