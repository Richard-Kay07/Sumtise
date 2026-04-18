# Definition of Done (DoD)

**Version:** 1.0  
**Last Updated:** January 2024

---

## Overview

This document defines the "Done means" criteria for all tickets and features in the Sumtise application. Every feature must meet **all** of these criteria before it can be considered complete.

---

## Core Requirements

### ✅ 1. Typed Inputs/Outputs

**Requirement:** All API endpoints, tRPC procedures, and functions must have fully typed inputs and outputs using Zod schemas and TypeScript types.

#### Checklist

- [ ] **Input Schema (Zod)**
  - [ ] All input fields defined with appropriate Zod validators
  - [ ] Required vs optional fields clearly marked
  - [ ] Validation rules (min/max, format, etc.) defined
  - [ ] Custom validation messages provided
  - [ ] Schema exported from `@/types/schemas`

- [ ] **Output Type (TypeScript)**
  - [ ] Return type explicitly defined
  - [ ] Type inferred from Prisma queries where possible
  - [ ] Complex types properly structured
  - [ ] Types exported for reuse

- [ ] **tRPC Integration**
  - [ ] Input schema used in `.input()` method
  - [ ] Output type inferred or explicitly typed
  - [ ] Type safety verified (no `any` types)

#### Example

```typescript
// ✅ CORRECT
import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { createInvoiceSchema } from "@/types/schemas"

export const invoicesRouter = createTRPCRouter({
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(createInvoiceSchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // input is fully typed
      const invoice = await prisma.invoice.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
        },
      })
      // Return type inferred from Prisma
      return invoice
    }),
})

// ❌ INCORRECT
export const invoicesRouter = createTRPCRouter({
  create: orgScopedProcedure
    .mutation(async ({ ctx, input }: any) => {  // ❌ No types
      // No validation, no type safety
      return await prisma.invoice.create({ data: input })
    }),
})
```

#### Files to Check

- `src/types/schemas.ts` - Input schemas
- `src/server/routers/*.ts` - tRPC routers
- `src/app/api/**/route.ts` - REST API routes

---

### ✅ 2. Organization Guard

**Requirement:** All organization-scoped operations must verify user membership and resource ownership.

#### Checklist

- [ ] **Organization Membership**
  - [ ] Uses `orgScopedProcedure` for tRPC endpoints
  - [ ] Verifies user is member of organization
  - [ ] Role is included in context

- [ ] **Resource Ownership**
  - [ ] `verifyResourceOwnership()` called for update/delete operations
  - [ ] Resource belongs to the organization
  - [ ] Error thrown if resource not found or unauthorized

- [ ] **Permission Checks**
  - [ ] Appropriate permission checked using `requirePermissionProcedure()`
  - [ ] Permission matches the operation (VIEW, CREATE, EDIT, DELETE)
  - [ ] Permission denied errors logged

#### Example

```typescript
// ✅ CORRECT
export const invoicesRouter = createTRPCRouter({
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
      data: updateInvoiceSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      
      return await prisma.invoice.update({
        where: { id: input.id },
        data: input.data,
      })
    }),
})

// ❌ INCORRECT
export const invoicesRouter = createTRPCRouter({
  update: protectedProcedure  // ❌ Not org-scoped
    .mutation(async ({ ctx, input }) => {
      // ❌ No ownership verification
      // ❌ No permission check
      return await prisma.invoice.update({
        where: { id: input.id },
        data: input.data,
      })
    }),
})
```

#### Files to Check

- `src/server/routers/*.ts` - All routers use `orgScopedProcedure`
- `src/lib/guards/organization.ts` - Guard functions
- `src/lib/permissions.ts` - Permission checks

---

### ✅ 3. Pagination

**Requirement:** All list/query endpoints must support pagination with consistent structure.

#### Checklist

- [ ] **Input Schema**
  - [ ] Uses `paginationSchema` from `@/types/schemas`
  - [ ] Includes `page` (default: 1) and `limit` (default: 10, max: 100)
  - [ ] Optional `sortBy` and `sortOrder` fields

- [ ] **Query Implementation**
  - [ ] Uses `skip` and `take` for Prisma queries
  - [ ] Calculates total count
  - [ ] Calculates total pages

- [ ] **Response Structure**
  - [ ] Returns paginated data with metadata
  - [ ] Includes `pagination` object with `page`, `limit`, `total`, `pages`
  - [ ] Data array in consistent property name (e.g., `invoices`, `customers`)

#### Example

```typescript
// ✅ CORRECT
import { paginationSchema } from "@/types/schemas"

export const invoicesRouter = createTRPCRouter({
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string(),
      ...paginationSchema.shape,
      status: z.enum(["DRAFT", "SENT", "PAID"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, limit, sortBy, sortOrder, status } = input
      
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null, // Soft delete
      }
      
      if (status) {
        where.status = status
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy ? { [sortBy]: sortOrder || "asc" } : { createdAt: "desc" },
        }),
        prisma.invoice.count({ where }),
      ])

      return {
        invoices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),
})

// ❌ INCORRECT
export const invoicesRouter = createTRPCRouter({
  getAll: orgScopedProcedure
    .query(async ({ ctx }) => {
      // ❌ No pagination
      // ❌ Could return thousands of records
      return await prisma.invoice.findMany({
        where: { organizationId: ctx.organizationId },
      })
    }),
})
```

#### Files to Check

- `src/types/schemas.ts` - `paginationSchema` definition
- `src/server/routers/*.ts` - All list endpoints

---

### ✅ 4. Soft-Delete

**Requirement:** All delete operations must use soft-delete (set `deletedAt` timestamp) instead of hard delete.

#### Checklist

- [ ] **Schema**
  - [ ] Model includes `deletedAt DateTime?` field
  - [ ] Field is nullable
  - [ ] Index on `deletedAt` for performance

- [ ] **Delete Implementation**
  - [ ] Uses `update()` with `deletedAt: new Date()`
  - [ ] Never uses `delete()` method
  - [ ] Returns updated record

- [ ] **Query Filters**
  - [ ] All queries filter out soft-deleted records (`deletedAt: null`)
  - [ ] Optional filter to include deleted records for admin

- [ ] **Restore Functionality** (if applicable)
  - [ ] Restore endpoint sets `deletedAt: null`
  - [ ] Permission check for restore operation

#### Example

```typescript
// ✅ CORRECT
export const invoicesRouter = createTRPCRouter({
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_DELETE))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
      
      // Soft delete
      return await prisma.invoice.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),

  getAll: orgScopedProcedure
    .query(async ({ ctx, input }) => {
      return await prisma.invoice.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null, // Exclude soft-deleted
        },
      })
    }),
})

// ❌ INCORRECT
export const invoicesRouter = createTRPCRouter({
  delete: orgScopedProcedure
    .mutation(async ({ ctx, input }) => {
      // ❌ Hard delete - data lost forever
      return await prisma.invoice.delete({
        where: { id: input.id },
      })
    }),
})
```

#### Files to Check

- `prisma/schema.prisma` - All models have `deletedAt` field
- `src/server/routers/*.ts` - Delete operations use soft-delete
- All queries filter `deletedAt: null`

---

### ✅ 5. Audit Entries

**Requirement:** All create, update, and delete operations must record audit trail entries.

#### Checklist

- [ ] **Audit Trail Recording**
  - [ ] `recordAudit()` called for create operations
  - [ ] `recordAudit()` called for update operations (with `before` and `after`)
  - [ ] `recordAudit()` called for delete operations
  - [ ] Audit includes correlation ID from context

- [ ] **Audit Data**
  - [ ] Entity type and ID recorded
  - [ ] Action type recorded (create, update, delete)
  - [ ] Before/after state captured (for updates)
  - [ ] User ID and organization ID included
  - [ ] Relevant metadata included

- [ ] **Error Handling**
  - [ ] Audit failures don't break main operation
  - [ ] Audit errors logged but don't throw

#### Example

```typescript
// ✅ CORRECT
import { recordAudit } from "@/lib/audit"

export const invoicesRouter = createTRPCRouter({
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
    .input(createInvoiceSchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
        },
      })

      // Record audit
      await recordAudit({
        entity: "invoice",
        entityId: invoice.id,
        action: "create",
        after: invoice,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
        },
      }).catch((error) => {
        // Log but don't fail
        ctx.logger?.warn("Audit recording failed", { error, invoiceId: invoice.id })
      })

      return invoice
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_EDIT))
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
      data: updateInvoiceSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("invoice", input.id, ctx.organizationId)

      // Get before state
      const before = await prisma.invoice.findUnique({
        where: { id: input.id },
      })

      // Update
      const after = await prisma.invoice.update({
        where: { id: input.id },
        data: input.data,
      })

      // Record audit with before/after
      await recordAudit({
        entity: "invoice",
        entityId: input.id,
        action: "update",
        before,
        after,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          changes: input.data,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, invoiceId: input.id })
      })

      return after
    }),
})

// ❌ INCORRECT
export const invoicesRouter = createTRPCRouter({
  create: orgScopedProcedure
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.create({ data: input })
      // ❌ No audit trail
      return invoice
    }),
})
```

#### Files to Check

- `src/lib/audit.ts` - Audit utility
- `src/server/routers/*.ts` - All mutating operations
- `prisma/schema.prisma` - `AuditLog` model exists

---

### ✅ 6. Tests (Unit + API + E2E)

**Requirement:** All features must have comprehensive test coverage across unit, API, and E2E tests.

#### Checklist

- [ ] **Unit Tests**
  - [ ] Test utility functions
  - [ ] Test business logic
  - [ ] Test validation schemas
  - [ ] Test error cases
  - [ ] Coverage > 80% for new code

- [ ] **API Tests**
  - [ ] Test successful operations
  - [ ] Test error cases (400, 401, 403, 404)
  - [ ] Test pagination
  - [ ] Test filtering/sorting
  - [ ] Test organization scoping
  - [ ] Test permission checks

- [ ] **E2E Tests**
  - [ ] Test user flows end-to-end
  - [ ] Test UI interactions
  - [ ] Test form submissions
  - [ ] Test navigation
  - [ ] Test error handling in UI

#### Example Test Structure

```typescript
// Unit Test Example
// tests/unit/lib/utils.test.ts
import { formatCurrency } from "@/lib/utils"

describe("formatCurrency", () => {
  it("should format GBP correctly", () => {
    expect(formatCurrency(100.50, "GBP")).toBe("£100.50")
  })
})

// API Test Example
// tests/api/invoices.spec.ts
import { test, expect } from "@playwright/test"
import { apiRequest, getAuthToken } from "../helpers/api-helpers"

test.describe("Invoices API", () => {
  test("should create invoice", async ({ request }) => {
    const token = await getAuthToken(request, "test@example.com", "password")
    const response = await apiRequest(request, "POST", "/api/trpc/invoices.create", {
      token,
      data: {
        organizationId: "org-123",
        customerId: "customer-123",
        date: "2024-01-15",
        items: [{ description: "Test", quantity: 1, unitPrice: 100 }],
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data).toHaveProperty("id")
  })

  test("should return 403 for unauthorized organization", async ({ request }) => {
    const token = await getAuthToken(request, "test@example.com", "password")
    const response = await apiRequest(request, "POST", "/api/trpc/invoices.create", {
      token,
      data: {
        organizationId: "unauthorized-org",
        // ...
      },
    })

    expect(response.status()).toBe(403)
  })
})

// E2E Test Example
// tests/e2e/invoices-flow.spec.ts
import { test, expect } from "../fixtures/auth"
import { navigateToModule, fillFieldByLabel } from "../helpers/page-helpers"

test.describe("Invoices Flow", () => {
  test("should create invoice", async ({ authenticatedPage }) => {
    await navigateToModule(authenticatedPage, "invoices")
    await authenticatedPage.click("text=Create Invoice")
    
    await fillFieldByLabel(authenticatedPage, "Customer", "Test Customer")
    await fillFieldByLabel(authenticatedPage, "Date", "2024-01-15")
    
    await authenticatedPage.click("text=Save")
    
    await expect(authenticatedPage.getByText(/created|saved/i)).toBeVisible()
  })
})
```

#### Test Coverage Requirements

- **Unit Tests**: > 80% coverage for new code
- **API Tests**: All endpoints tested (success + error cases)
- **E2E Tests**: Critical user flows covered

#### Files to Check

- `tests/unit/**/*.test.ts` - Unit tests
- `tests/api/**/*.spec.ts` - API tests
- `tests/e2e/**/*.spec.ts` - E2E tests
- `postman/*.postman_collection.json` - Postman tests

---

### ✅ 7. Documentation Updated

**Requirement:** All features must have updated documentation.

#### Checklist

- [ ] **Code Documentation**
  - [ ] JSDoc comments on functions/classes
  - [ ] Parameter descriptions
  - [ ] Return type descriptions
  - [ ] Example usage in comments

- [ ] **API Documentation**
  - [ ] Endpoint documented in Postman collection
  - [ ] Request/response examples
  - [ ] Error responses documented

- [ ] **User Documentation**
  - [ ] Feature documented in user guide (if applicable)
  - [ ] Screenshots or examples (if UI feature)

- [ ] **Developer Documentation**
  - [ ] Architecture decisions documented
  - [ ] Integration guide updated
  - [ ] Migration guide (if schema changes)

#### Example

```typescript
/**
 * Creates a new invoice for the organization.
 * 
 * @param input - Invoice creation data including customer, items, dates
 * @returns Created invoice with generated invoice number
 * 
 * @example
 * ```typescript
 * const invoice = await trpc.invoices.create.mutate({
 *   organizationId: "org-123",
 *   customerId: "customer-123",
 *   date: "2024-01-15",
 *   items: [{ description: "Service", quantity: 1, unitPrice: 100 }],
 * })
 * ```
 * 
 * @throws {TRPCError} 403 if user doesn't have INVOICES_CREATE permission
 * @throws {TRPCError} 404 if customer not found
 */
```

#### Files to Check

- Code files - JSDoc comments
- `postman/*.postman_collection.json` - API docs
- `README.md` - Feature updates
- `OPS_GUIDE.md` - Operational docs
- `UAT_CHECKLIST.md` - Testing docs

---

### ✅ 8. Seed Data Updated

**Requirement:** All new models/features must have seed data for demo/testing.

#### Checklist

- [ ] **Seed Script**
  - [ ] New models seeded in `prisma/seed.ts` or `scripts/uat-initializer.ts`
  - [ ] Seed data is realistic
  - [ ] Seed data covers common use cases
  - [ ] Seed is idempotent (can run multiple times)

- [ ] **Demo Organization**
  - [ ] Demo Org has sample data for new feature
  - [ ] Data is immediately usable for testing
  - [ ] Data demonstrates feature capabilities

- [ ] **Test Data**
  - [ ] Test fixtures include new data types
  - [ ] Test data supports all test scenarios

#### Example

```typescript
// scripts/uat-initializer.ts
async function seedInvoices(organizationId: string) {
  const customer = await prisma.customer.findFirst({
    where: { organizationId },
  })

  if (!customer) return

  // Check if invoice already exists (idempotent)
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId,
      invoiceNumber: "INV-001",
    },
  })

  if (existingInvoice) {
    console.log("Invoice INV-001 already exists, skipping")
    return
  }

  // Create invoice
  await prisma.invoice.create({
    data: {
      organizationId,
      customerId: customer.id,
      invoiceNumber: "INV-001",
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "SENT",
      items: {
        create: [
          {
            description: "Consulting Services",
            quantity: 10,
            unitPrice: new Decimal(100.00),
            taxRate: new Decimal(20.00),
          },
        ],
      },
      subtotal: new Decimal(1000.00),
      taxAmount: new Decimal(200.00),
      total: new Decimal(1200.00),
    },
  })
}
```

#### Files to Check

- `prisma/seed.ts` - Main seed script
- `scripts/uat-initializer.ts` - UAT seed script
- `tests/fixtures/**/*.ts` - Test fixtures

---

## Feature Completion Checklist

Use this checklist for every feature/ticket:

### Pre-Development
- [ ] Requirements understood
- [ ] Design reviewed
- [ ] Dependencies identified

### Development
- [ ] ✅ Typed inputs/outputs (Zod + TypeScript)
- [ ] ✅ Organization guard (membership + ownership)
- [ ] ✅ Pagination (for list endpoints)
- [ ] ✅ Soft-delete (deletedAt field)
- [ ] ✅ Audit entries (recordAudit calls)
- [ ] ✅ Tests written (unit + API + E2E)
- [ ] ✅ Documentation updated
- [ ] ✅ Seed data updated

### Post-Development
- [ ] Code reviewed
- [ ] Tests passing
- [ ] Linter passing
- [ ] Build successful
- [ ] Manual testing completed
- [ ] UAT ready

---

## Quick Reference

### File Locations

| Requirement | Files to Check |
|------------|----------------|
| Typed I/O | `src/types/schemas.ts`, `src/server/routers/*.ts` |
| Org Guard | `src/lib/guards/organization.ts`, `src/lib/permissions.ts` |
| Pagination | `src/types/schemas.ts` (paginationSchema), routers |
| Soft-Delete | `prisma/schema.prisma`, delete operations |
| Audit | `src/lib/audit.ts`, mutating operations |
| Tests | `tests/unit/`, `tests/api/`, `tests/e2e/` |
| Docs | Code comments, `README.md`, Postman collection |
| Seed Data | `prisma/seed.ts`, `scripts/uat-initializer.ts` |

### Common Patterns

```typescript
// Standard tRPC endpoint pattern
export const myRouter = createTRPCRouter({
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_VIEW))
    .input(z.object({
      organizationId: z.string(),
      ...paginationSchema.shape,
    }))
    .query(async ({ ctx, input }) => {
      const [items, total] = await Promise.all([
        prisma.myModel.findMany({
          where: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        prisma.myModel.count({ where: { ... } }),
      ])
      return { items, pagination: { ... } }
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_CREATE))
    .input(createMyModelSchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.myModel.create({ data: { ...input } })
      await recordAudit({ entity: "myModel", action: "create", ... })
      return item
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_EDIT))
    .input(z.object({ id: z.string(), organizationId: z.string(), data: updateSchema }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
      const before = await prisma.myModel.findUnique({ where: { id: input.id } })
      const after = await prisma.myModel.update({ where: { id: input.id }, data: input.data })
      await recordAudit({ entity: "myModel", action: "update", before, after, ... })
      return after
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_DELETE))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
      const item = await prisma.myModel.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
      await recordAudit({ entity: "myModel", action: "delete", ... })
      return item
    }),
})
```

---

## Enforcement

### Code Review Checklist

Reviewers should verify all DoD criteria are met:

1. ✅ Typed inputs/outputs
2. ✅ Organization guard
3. ✅ Pagination (if applicable)
4. ✅ Soft-delete (if applicable)
5. ✅ Audit entries
6. ✅ Tests (unit + API + E2E)
7. ✅ Documentation
8. ✅ Seed data

### Automated Checks

- **TypeScript**: Compiler enforces types
- **Linter**: ESLint rules for patterns
- **Tests**: CI/CD runs all tests
- **Build**: Fails if types/imports incorrect

### Manual Checks

- **Code Review**: Reviewer verifies DoD
- **UAT**: Feature tested in demo environment
- **Documentation**: Docs reviewed for completeness

---

## Summary

Every feature must meet **all 8 criteria**:

1. ✅ **Typed Inputs/Outputs** - Zod schemas + TypeScript types
2. ✅ **Organization Guard** - Membership + ownership verification
3. ✅ **Pagination** - Consistent pagination for list endpoints
4. ✅ **Soft-Delete** - Use `deletedAt` instead of hard delete
5. ✅ **Audit Entries** - Record all create/update/delete operations
6. ✅ **Tests** - Unit + API + E2E test coverage
7. ✅ **Documentation** - Code docs + API docs + user docs
8. ✅ **Seed Data** - Demo data for testing

**No feature is "done" until all criteria are met.**

