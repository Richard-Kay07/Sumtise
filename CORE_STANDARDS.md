# Sumtise Core Standards & Scaffolding

**Version:** 1.0  
**Last Updated:** January 2024  
**Applies To:** All development tasks

---

## Overview

This document establishes the core conventions, patterns, and standards that **MUST** be followed for all Sumtise development. These standards ensure consistency, security, maintainability, and scalability across the entire codebase.

---

## 1. MULTI-TENANT ORGANIZATION SCOPING

### 1.1 Organization Context

**All organization-scoped operations MUST:**
- Use `orgScopedProcedure` from `@/lib/trpc`
- Extract `organizationId` from session context (never from client input)
- Verify organization membership before any operation
- Include `organizationId` in all database queries

### 1.2 Implementation Pattern

```typescript
import { orgScopedProcedure } from "@/lib/trpc"
import { z } from "zod"

export const myRouter = createTRPCRouter({
  getAll: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(), // Required but verified by middleware
      // ... other inputs
    }))
    .query(async ({ ctx, input }) => {
      // ctx.organizationId is automatically set by orgScopedProcedure
      // Use ctx.organizationId, NOT input.organizationId
      
      return await prisma.myModel.findMany({
        where: {
          organizationId: ctx.organizationId, // Always use from context
          // ... other filters
        },
      })
    }),
})
```

### 1.3 Resource Ownership Verification

**For update/delete operations, ALWAYS verify resource ownership:**

```typescript
import { verifyResourceOwnership } from "@/lib/guards/organization"

update: orgScopedProcedure
  .input(z.object({
    id: z.string(),
    organizationId: z.string(),
    data: z.object({ /* ... */ }),
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify the resource belongs to the organization
    await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
    
    return await prisma.myModel.update({
      where: { id: input.id },
      data: input.data,
    })
  }),
```

### 1.4 Organization ID in Session

**The session MUST include organization context:**

```typescript
// In tRPC context creation
const organizationId = session?.user?.organizationId || null

// In orgScopedProcedure middleware
if (!organizationId) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Organization context required",
  })
}
```

---

## 2. SOFT DELETE PATTERN

### 2.1 Database Schema

**All models that support soft delete MUST include:**

```prisma
model MyModel {
  id        String   @id @default(cuid())
  // ... other fields
  deletedAt DateTime? // Soft delete timestamp
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([organizationId, deletedAt]) // For efficient queries
  @@map("my_models")
}
```

### 2.2 Query Pattern

**ALWAYS exclude soft-deleted records in queries:**

```typescript
// ✅ CORRECT - Exclude soft-deleted
const items = await prisma.myModel.findMany({
  where: {
    organizationId: ctx.organizationId,
    deletedAt: null, // Explicitly exclude deleted
  },
})

// ❌ WRONG - Missing deletedAt filter
const items = await prisma.myModel.findMany({
  where: {
    organizationId: ctx.organizationId,
    // Missing deletedAt: null
  },
})
```

### 2.3 Delete Operation

**Use soft delete, never hard delete:**

```typescript
// ✅ CORRECT - Soft delete
delete: orgScopedProcedure
  .input(z.object({ id: z.string(), organizationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
    
    return await prisma.myModel.update({
      where: { id: input.id },
      data: { deletedAt: new Date() },
    })
  }),

// ❌ WRONG - Hard delete
delete: orgScopedProcedure
  .mutation(async ({ ctx, input }) => {
    return await prisma.myModel.delete({
      where: { id: input.id },
    })
  }),
```

### 2.4 Alternative: isActive Flag

**For models that use `isActive` instead of `deletedAt`:**

```prisma
model MyModel {
  id        String   @id @default(cuid())
  isActive  Boolean  @default(true)
  // ...
}
```

```typescript
// Query pattern
const items = await prisma.myModel.findMany({
  where: {
    organizationId: ctx.organizationId,
    isActive: true, // Explicitly filter active
  },
})

// Delete pattern
return await prisma.myModel.update({
  where: { id: input.id },
  data: { isActive: false },
})
```

---

## 3. DATE HANDLING

### 3.1 ISO 8601 Format

**All dates MUST:**
- Be stored in UTC in the database
- Be transmitted as ISO 8601 strings in APIs
- Be converted to user's timezone in the frontend

### 3.2 Database Schema

```prisma
model MyModel {
  id        String   @id @default(cuid())
  date      DateTime // Stored as UTC
  createdAt DateTime @default(now()) // Auto-set to UTC
  updatedAt DateTime @updatedAt // Auto-updated to UTC
}
```

### 3.3 API Input/Output

```typescript
// ✅ CORRECT - Accept ISO string or Date, convert to Date
.input(z.object({
  date: z.union([z.date(), z.string()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val
  }),
}))

// ✅ CORRECT - Return ISO string
.query(async ({ ctx, input }) => {
  const item = await prisma.myModel.findUnique({
    where: { id: input.id },
  })
  
  return {
    ...item,
    date: item.date.toISOString(), // Convert to ISO string
  }
})
```

### 3.4 Date Range Queries

```typescript
// ✅ CORRECT - Date range with end-of-day handling
.input(z.object({
  startDate: z.union([z.date(), z.string()]).optional(),
  endDate: z.union([z.date(), z.string()]).optional(),
}))
.query(async ({ ctx, input }) => {
  const where: any = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  }
  
  if (input.startDate || input.endDate) {
    where.date = {}
    
    if (input.startDate) {
      const start = typeof input.startDate === 'string' 
        ? new Date(input.startDate) 
        : input.startDate
      where.date.gte = start
    }
    
    if (input.endDate) {
      const end = typeof input.endDate === 'string'
        ? new Date(input.endDate)
        : input.endDate
      // Set to end of day for inclusive end date
      end.setHours(23, 59, 59, 999)
      where.date.lte = end
    }
  }
  
  return await prisma.myModel.findMany({ where })
})
```

---

## 4. PAGINATION

### 4.1 Standard Pagination Schema

**Use consistent pagination across all list endpoints:**

```typescript
// In @/types/schemas.ts
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20), // Note: Using 'limit' to match existing codebase
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})
```

### 4.2 Implementation Pattern

```typescript
import { paginationSchema } from "@/types/schemas"

getAll: orgScopedProcedure
  .input(z.object({
    organizationId: z.string(),
    ...paginationSchema.shape,
    // ... other filters
  }))
  .query(async ({ ctx, input }) => {
    const { page, limit } = input
    
    const where = {
      organizationId: ctx.organizationId,
      deletedAt: null,
      // ... other filters
    }
    
    const [items, total] = await Promise.all([
      prisma.myModel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // ... orderBy
      }),
      prisma.myModel.count({ where }),
    ])
    
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  })
```

### 4.3 Response Format

```typescript
// ✅ CORRECT - Standardized pagination response
{
  items: MyModel[],
  pagination: {
    page: number,
    pageSize: number,
    total: number,
    totalPages: number,
  }
}

// ❌ WRONG - Inconsistent format
{
  data: MyModel[],
  page: number,
  limit: number,
  count: number,
}
```

---

## 5. SORTING

### 5.1 Standard Sorting Schema

**Note:** Sorting is included in `paginationSchema` in the existing codebase. For consistency, you can either:
- Use `paginationSchema` which includes sorting, OR
- Extract sorting into a separate schema if preferred

```typescript
// In @/types/schemas.ts (already exists)
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

// OR separate sorting schema (if preferred)
export const sortingSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})
```

### 5.2 Implementation Pattern

```typescript
import { sortingSchema } from "@/types/schemas"

getAll: orgScopedProcedure
  .input(z.object({
    organizationId: z.string(),
    ...paginationSchema.shape, // Includes page, limit, sortBy, sortOrder
  }))
  .query(async ({ ctx, input }) => {
    const { sortBy, sortOrder } = input
    
    // Validate sortBy field exists on model
    const allowedSortFields = ["createdAt", "updatedAt", "date", "name"]
    const validSortBy = sortBy && allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt"
    
    return await prisma.myModel.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      orderBy: {
        [validSortBy]: sortOrder,
      },
      // ... pagination
    })
  })
```

### 5.3 Default Sorting

**Default sorting rules:**
- List endpoints: `createdAt DESC` (newest first)
- Reports: `date DESC` (most recent)
- Search results: Relevance first, then `createdAt DESC`

---

## 6. QUERY FILTERS

### 6.1 Standard Filter Schema

```typescript
// In @/types/schemas.ts
export const commonFiltersSchema = z.object({
  search: z.string().optional(), // Text search
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING"]).optional(),
  dateFrom: z.union([z.date(), z.string()]).optional(),
  dateTo: z.union([z.date(), z.string()]).optional(),
})
```

### 6.2 Implementation Pattern

```typescript
getAll: orgScopedProcedure
  .input(z.object({
    organizationId: z.string(),
    ...paginationSchema.shape,
    ...sortingSchema.shape,
    ...commonFiltersSchema.shape,
    // Module-specific filters
    customFilter: z.string().optional(),
  }))
  .query(async ({ ctx, input }) => {
    const { search, status, dateFrom, dateTo, customFilter } = input
    
    const where: any = {
      organizationId: ctx.organizationId,
      deletedAt: null,
    }
    
    // Text search (case-insensitive)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
      ]
    }
    
    // Status filter
    if (status) {
      where.status = status
    }
    
    // Date range
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        const from = typeof dateFrom === 'string' ? new Date(dateFrom) : dateFrom
        where.date.gte = from
      }
      if (dateTo) {
        const to = typeof dateTo === 'string' ? new Date(dateTo) : dateTo
        to.setHours(23, 59, 59, 999)
        where.date.lte = to
      }
    }
    
    // Custom filter
    if (customFilter) {
      where.customField = customFilter
    }
    
    return await prisma.myModel.findMany({ where, /* ... */ })
  })
```

### 6.3 Filter Best Practices

- **Always validate enum values** before using in queries
- **Use case-insensitive search** for text fields
- **Combine filters with AND logic** (all filters must match)
- **Use OR logic only for search** (search across multiple fields)
- **Index frequently filtered fields** in database schema

---

## 7. IDEMPOTENCY KEYS

### 7.1 Purpose

**Idempotency keys prevent duplicate operations** when:
- Network retries occur
- User double-clicks submit
- Webhook retries happen
- API calls are retried

### 7.2 Database Schema

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

### 7.3 Implementation Pattern

```typescript
import { TRPCError } from "@trpc/server"

create: orgScopedProcedure
  .input(z.object({
    organizationId: z.string(),
    idempotencyKey: z.string().optional(), // Client-provided key
    // ... other inputs
  }))
  .mutation(async ({ ctx, input }) => {
    // Generate idempotency key if not provided
    const idempotencyKey = input.idempotencyKey || `create-${Date.now()}-${Math.random()}`
    
    // Check for existing operation
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    })
    
    if (existing && existing.expiresAt > new Date()) {
      // Return cached result
      return existing.result as MyModel
    }
    
    // Perform operation
    const result = await prisma.myModel.create({
      data: {
        organizationId: ctx.organizationId,
        // ... other fields
      },
    })
    
    // Store idempotency key
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        operation: "createMyModel",
        result: result as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    })
    
    return result
  })
```

### 7.4 When to Use Idempotency Keys

**REQUIRED for:**
- ✅ Payment processing
- ✅ Invoice creation
- ✅ Payment run processing
- ✅ Batch operations
- ✅ Webhook handlers

**OPTIONAL for:**
- ⚠️ Simple CRUD operations (if retry-safe)
- ⚠️ Read operations (not needed)

---

## 8. ZOD FOR INPUT VALIDATION

### 8.1 Schema Definition

**Define schemas in `@/types/schemas.ts`:**

```typescript
import { z } from "zod"

// Base schema
export const createMyModelSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  amount: z.number().positive(),
  date: z.union([z.date(), z.string()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val
  }),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
})

// Update schema (all fields optional)
export const updateMyModelSchema = createMyModelSchema.partial()

// Extended schema with organizationId
export const createMyModelWithOrgSchema = createMyModelSchema.extend({
  organizationId: z.string(),
})
```

### 8.2 Usage in tRPC

```typescript
import { createMyModelSchema } from "@/types/schemas"

create: orgScopedProcedure
  .input(createMyModelSchema.extend({
    organizationId: z.string(),
  }))
  .mutation(async ({ ctx, input }) => {
    // Input is already validated by Zod
    // TypeScript types are inferred
    
    return await prisma.myModel.create({
      data: {
        ...input,
        organizationId: ctx.organizationId, // Use from context
      },
    })
  }),

update: orgScopedProcedure
  .input(z.object({
    id: z.string(),
    organizationId: z.string(),
    data: createMyModelSchema.partial(), // All fields optional
  }))
  .mutation(async ({ ctx, input }) => {
    await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
    
    return await prisma.myModel.update({
      where: { id: input.id },
      data: input.data,
    })
  })
```

### 8.3 Validation Best Practices

- **Validate at the boundary** (tRPC input)
- **Use descriptive error messages**
- **Transform data when needed** (e.g., string to Date)
- **Use enums for fixed values**
- **Set sensible defaults**
- **Validate array lengths** for batch operations
- **Use `.refine()` for complex validation**

```typescript
// Example: Complex validation
export const createInvoiceSchema = z.object({
  customerId: z.string(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1, "At least one item required"),
  date: z.date(),
  dueDate: z.date(),
}).refine((data) => data.dueDate >= data.date, {
  message: "Due date must be after invoice date",
  path: ["dueDate"],
})
```

---

## 9. tRPC ERROR HANDLING

### 9.1 Standard Error Codes

**Use appropriate tRPC error codes:**

```typescript
import { TRPCError } from "@trpc/server"

// ✅ CORRECT - Use appropriate error codes
throw new TRPCError({
  code: "UNAUTHORIZED",
  message: "You must be logged in",
})

throw new TRPCError({
  code: "FORBIDDEN",
  message: "You don't have permission to access this resource",
})

throw new TRPCError({
  code: "NOT_FOUND",
  message: "Resource not found",
})

throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Invalid input data",
})

throw new TRPCError({
  code: "CONFLICT",
  message: "Resource already exists",
})

throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: "An unexpected error occurred",
})
```

### 9.2 Error Handling Pattern

```typescript
getById: orgScopedProcedure
  .input(z.object({
    id: z.string(),
    organizationId: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    const item = await prisma.myModel.findFirst({
      where: {
        id: input.id,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    })
    
    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Resource not found",
      })
    }
    
    return item
  })
```

### 9.3 Error Logging

```typescript
import { logger } from "@/lib/logger" // Your logging utility

create: orgScopedProcedure
  .input(createMyModelSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      return await prisma.myModel.create({
        data: {
          ...input,
          organizationId: ctx.organizationId,
        },
      })
    } catch (error) {
      // Log error for debugging
      logger.error("Failed to create myModel", {
        error,
        input,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
      })
      
      // Re-throw as tRPC error
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create resource",
        cause: error,
      })
    }
  })
```

---

## 10. PRISMA DATABASE PATTERNS

### 10.1 Query Patterns

```typescript
// ✅ CORRECT - Include related data when needed
const invoice = await prisma.invoice.findUnique({
  where: { id },
  include: {
    customer: true,
    items: true,
    creditNotes: true,
  },
})

// ✅ CORRECT - Select specific fields for performance
const invoices = await prisma.invoice.findMany({
  where: { organizationId },
  select: {
    id: true,
    invoiceNumber: true,
    total: true,
    status: true,
    customer: {
      select: {
        name: true,
      },
    },
  },
})

// ✅ CORRECT - Use transactions for multi-step operations
await prisma.$transaction(async (tx) => {
  const invoice = await tx.invoice.create({ data: invoiceData })
  await tx.transaction.createMany({ data: transactions })
  await tx.customer.update({
    where: { id: invoice.customerId },
    data: { creditLimit: { decrement: invoice.total } },
  })
  return invoice
})
```

### 10.2 Database Indexes

```prisma
model MyModel {
  id             String   @id @default(cuid())
  organizationId String
  status         String
  date           DateTime
  deletedAt      DateTime?
  
  // Indexes for common queries
  @@index([organizationId, deletedAt])
  @@index([organizationId, status])
  @@index([organizationId, date])
  @@index([organizationId, status, date])
}
```

### 10.3 Prisma Best Practices

- **Always include `organizationId` in where clauses**
- **Always filter `deletedAt: null` for soft-deleted models**
- **Use `include` for related data, `select` for performance**
- **Use transactions for multi-step operations**
- **Add indexes for frequently queried fields**
- **Use `findFirst` instead of `findUnique` when filtering by non-unique fields**
- **Use `createMany` for bulk inserts**
- **Use `updateMany` for bulk updates**

---

## 11. COMPLETE EXAMPLE

### 11.1 Router Implementation

```typescript
// src/server/routers/myModel.ts
import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { paginationSchema, sortingSchema } from "@/types/schemas"
import { TRPCError } from "@trpc/server"

// Schema
const createMyModelSchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.number().positive(),
  date: z.union([z.date(), z.string()]).transform((val) => {
    return typeof val === 'string' ? new Date(val) : val
  }),
})

const updateMyModelSchema = createMyModelSchema.partial()

// Router
export const myModelRouter = createTRPCRouter({
  getAll: orgScopedProcedure
    .input(z.object({
      organizationId: z.string(),
      ...paginationSchema.shape,
      ...sortingSchema.shape,
      search: z.string().optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { page, pageSize, sortBy, sortOrder, search, status } = input
      
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      }
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
        ]
      }
      
      if (status) {
        where.status = status
      }
      
      const allowedSortFields = ["createdAt", "updatedAt", "date", "name"]
      const validSortBy = sortBy && allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt"
      
      const [items, total] = await Promise.all([
        prisma.myModel.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [validSortBy]: sortOrder },
        }),
        prisma.myModel.count({ where }),
      ])
      
      return {
        items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      }
    }),

  getById: orgScopedProcedure
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.myModel.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      })
      
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resource not found",
        })
      }
      
      return item
    }),

  create: orgScopedProcedure
    .input(createMyModelSchema.extend({
      organizationId: z.string(),
      idempotencyKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey, ...data } = input
      
      // Idempotency check
      if (idempotencyKey) {
        const existing = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        })
        
        if (existing && existing.expiresAt > new Date()) {
          return existing.result as any
        }
      }
      
      const item = await prisma.myModel.create({
        data: {
          ...data,
          organizationId: ctx.organizationId,
        },
      })
      
      // Store idempotency key
      if (idempotencyKey) {
        await prisma.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            operation: "createMyModel",
            result: item as any,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })
      }
      
      return item
    }),

  update: orgScopedProcedure
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
      data: updateMyModelSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
      
      return await prisma.myModel.update({
        where: { id: input.id },
        data: input.data,
      })
    }),

  delete: orgScopedProcedure
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
      
      return await prisma.myModel.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })
    }),
})
```

### 11.2 Database Schema

```prisma
model MyModel {
  id             String    @id @default(cuid())
  organizationId String
  name           String
  amount         Decimal
  date           DateTime
  status         String    @default("ACTIVE")
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, deletedAt])
  @@index([organizationId, status])
  @@index([organizationId, date])
  @@map("my_models")
}
```

---

## 12. CHECKLIST FOR NEW ROUTERS

When creating a new router, ensure:

- [ ] Uses `orgScopedProcedure` for organization-scoped operations
- [ ] Uses `ctx.organizationId` (never `input.organizationId`)
- [ ] Verifies resource ownership for update/delete
- [ ] Implements soft delete (or `isActive` flag)
- [ ] Filters `deletedAt: null` in all queries
- [ ] Uses ISO date format for dates
- [ ] Implements pagination with `{page, pageSize}`
- [ ] Implements sorting with `{sortBy, sortOrder}`
- [ ] Implements query filters (search, status, dates)
- [ ] Uses idempotency keys for mutating operations
- [ ] Validates input with Zod schemas
- [ ] Uses appropriate tRPC error codes
- [ ] Logs errors appropriately
- [ ] Includes database indexes for common queries
- [ ] Follows Prisma best practices

---

## 13. COMMON PITFALLS TO AVOID

### ❌ DON'T

```typescript
// ❌ Using input.organizationId instead of ctx.organizationId
getAll: orgScopedProcedure
  .input(z.object({ organizationId: z.string() }))
  .query(async ({ ctx, input }) => {
    return await prisma.myModel.findMany({
      where: { organizationId: input.organizationId }, // WRONG!
    })
  })

// ❌ Missing deletedAt filter
getAll: orgScopedProcedure
  .query(async ({ ctx }) => {
    return await prisma.myModel.findMany({
      where: { organizationId: ctx.organizationId }, // Missing deletedAt!
    })
  })

// ❌ Hard delete
delete: orgScopedProcedure
  .mutation(async ({ ctx, input }) => {
    return await prisma.myModel.delete({ // WRONG - hard delete!
      where: { id: input.id },
    })
  })

// ❌ No resource ownership verification
update: orgScopedProcedure
  .mutation(async ({ ctx, input }) => {
    return await prisma.myModel.update({ // WRONG - no verification!
      where: { id: input.id },
      data: input.data,
    })
  })
```

### ✅ DO

```typescript
// ✅ Using ctx.organizationId
getAll: orgScopedProcedure
  .input(z.object({ organizationId: z.string() }))
  .query(async ({ ctx }) => {
    return await prisma.myModel.findMany({
      where: {
        organizationId: ctx.organizationId, // CORRECT!
        deletedAt: null, // CORRECT!
      },
    })
  })

// ✅ Soft delete
delete: orgScopedProcedure
  .mutation(async ({ ctx, input }) => {
    await verifyResourceOwnership("myModel", input.id, ctx.organizationId) // CORRECT!
    
    return await prisma.myModel.update({ // CORRECT - soft delete!
      where: { id: input.id },
      data: { deletedAt: new Date() },
    })
  })
```

---

## 14. QUICK REFERENCE

### Standard Imports

```typescript
import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { paginationSchema, sortingSchema } from "@/types/schemas"
import { TRPCError } from "@trpc/server"
```

### Standard Patterns

- **Organization scoping:** `orgScopedProcedure` + `ctx.organizationId`
- **Soft delete:** `deletedAt: null` in queries, `deletedAt: new Date()` on delete
- **Pagination:** `{page, limit}` with `skip`/`take` (matches existing codebase)
- **Sorting:** `{sortBy, sortOrder}` with validation
- **Dates:** ISO strings in API, UTC in database
- **Idempotency:** Key on mutating operations
- **Validation:** Zod schemas for all inputs
- **Errors:** tRPC error codes with messages
- **Database:** Prisma with proper indexes

---

**Document Version:** 1.0  
**Last Updated:** January 2024  
**Applies To:** All Sumtise development

