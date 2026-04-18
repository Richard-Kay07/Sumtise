# Organization-Scoped Security Guards

This document describes the organization-scoped security guards implemented in Sumtise to ensure proper data isolation and access control.

## Overview

All API endpoints (both tRPC and REST) now include organization-scoped guards that:

1. **Verify Organization Membership**: Ensures users can only access organizations they belong to
2. **Verify Resource Ownership**: Ensures resources belong to the specified organization before operations
3. **Enforce Server-Side Validation**: All validation happens server-side, preventing client-side bypass

## Implementation

### tRPC Procedures

#### Organization-Scoped Procedure

Use `orgScopedProcedure` instead of `protectedProcedure` for all organization-scoped endpoints:

```typescript
import { orgScopedProcedure } from "@/lib/trpc"

invoices: createTRPCRouter({
  getAll: orgScopedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // ctx.organizationId is guaranteed to be valid and user has access
      return await prisma.invoice.findMany({
        where: { organizationId: ctx.organizationId }
      })
    }),
})
```

**What it does:**
- Extracts `organizationId` from input
- Verifies user is a member of the organization
- Adds `organizationId` to context (from verified value, not input)
- Throws `FORBIDDEN` if user is not a member
- Throws `BAD_REQUEST` if `organizationId` is missing

#### Resource Ownership Verification

For update/delete operations, verify resource ownership:

```typescript
update: orgScopedProcedure
  .input(z.object({
    id: z.string(),
    organizationId: z.string(),
    data: updateSchema,
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify resource belongs to organization
    await verifyResourceOwnership("invoice", input.id, ctx.organizationId)
    
    return await prisma.invoice.update({
      where: { id: input.id },
      data: input.data,
    })
  }),
```

### REST API Routes

#### Organization Guard

Use `requireOrganizationAccess` helper:

```typescript
import { requireOrganizationAccess } from "@/lib/guards/rest-api"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get("organizationId")
  
  // Verify organization access
  await requireOrganizationAccess(request, organizationId)
  
  // Continue with operation...
}
```

**What it does:**
- Gets authenticated session from request
- Extracts `organizationId` from query params, body, or parameter
- Verifies user is a member of the organization
- Throws appropriate errors for invalid access

## Security Features

### 1. Organization Membership Verification

```typescript
await verifyOrganizationMembership(userId, organizationId)
```

- Checks `OrganizationMember` table for membership
- Throws `FORBIDDEN` if user is not a member
- Prevents access to organizations user doesn't belong to

### 2. Resource Ownership Verification

```typescript
await verifyResourceOwnership("invoice", resourceId, organizationId)
```

- Verifies resource exists
- Checks resource belongs to specified organization
- Throws `NOT_FOUND` if resource doesn't exist
- Throws `FORBIDDEN` if resource belongs to different organization

### 3. Server-Side Validation

All organization IDs are:
- Validated server-side (never trust client input)
- Verified against user's actual memberships
- Used from context (not from client input) after verification

## Error Responses

### tRPC Errors

- `UNAUTHORIZED` (401): User not authenticated
- `FORBIDDEN` (403): User not a member of organization
- `NOT_FOUND` (404): Resource doesn't exist
- `BAD_REQUEST` (400): Missing or invalid `organizationId`

### REST API Errors

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User not a member of organization
- `404 Not Found`: Resource doesn't exist
- `400 Bad Request`: Missing or invalid `organizationId`

## Protected Resources

All of the following resources are now protected:

- **Invoices**: Create, read, update, delete
- **Customers**: Create, read, update, delete
- **Vendors**: Create, read, update, delete
- **Bills**: Create, read, update, delete
- **Transactions**: Create, read
- **Bank Accounts**: Create, read, update, delete
- **Chart of Accounts**: Create, read, update, delete
- **Payments**: Create, read
- **Payment Runs**: Create, read
- **Credit Notes**: Create, read
- **Debit Notes**: Create, read
- **Dashboard Stats**: Read
- **Settings**: Create, read, update, delete

## Testing

### Negative Tests

See `tests/negative/org-access.spec.ts` for tests that verify:

1. **Unauthorized Access**: Users cannot access organizations they're not members of
2. **Cross-Organization Access**: Users cannot access resources from other organizations
3. **Missing Authentication**: Unauthenticated requests are rejected
4. **Missing Organization ID**: Requests without `organizationId` are rejected

### Running Tests

```bash
# Run negative tests
npm run test -- tests/negative

# Run all tests including security tests
npm test
```

## Best Practices

1. **Always use `orgScopedProcedure`** for organization-scoped endpoints
2. **Always verify resource ownership** for update/delete operations
3. **Use `ctx.organizationId`** from context, never from input after verification
4. **Validate organizationId presence** in input schemas
5. **Include organizationId in all mutations** that modify organization-scoped resources

## Migration Checklist

When adding new endpoints:

- [ ] Use `orgScopedProcedure` instead of `protectedProcedure`
- [ ] Extract `organizationId` from input
- [ ] Use `ctx.organizationId` for queries (not input)
- [ ] Verify resource ownership for update/delete
- [ ] Include `organizationId` in input schema for mutations
- [ ] Add negative tests for unauthorized access

## Example: Adding New Endpoint

```typescript
// ✅ Correct implementation
products: createTRPCRouter({
  getAll: orgScopedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Use ctx.organizationId, not input.organizationId
      return await prisma.product.findMany({
        where: { organizationId: ctx.organizationId }
      })
    }),

  update: orgScopedProcedure
    .input(z.object({
      id: z.string(),
      organizationId: z.string(),
      data: updateProductSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      await verifyResourceOwnership("product", input.id, ctx.organizationId)
      
      return await prisma.product.update({
        where: { id: input.id },
        data: input.data,
      })
    }),
})

// ❌ Incorrect - no guard
products: createTRPCRouter({
  getAll: protectedProcedure  // Missing org guard!
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // User could pass any organizationId!
      return await prisma.product.findMany({
        where: { organizationId: input.organizationId }
      })
    }),
})
```

## Related Files

- `src/lib/guards/organization.ts` - Core guard functions
- `src/lib/guards/rest-api.ts` - REST API guard helpers
- `src/lib/trpc.ts` - tRPC middleware definitions
- `src/server/routers/app.ts` - tRPC router implementations
- `src/app/api/settings/route.ts` - Example REST API with guards
- `tests/negative/org-access.spec.ts` - Negative test suite

