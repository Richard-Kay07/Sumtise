# Pull Request

## Description

<!-- Describe your changes -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring

## Definition of Done Checklist

### ✅ 1. Typed Inputs/Outputs
- [ ] All inputs use Zod schemas
- [ ] All outputs are typed
- [ ] No `any` types
- [ ] Schemas exported from `@/types/schemas`

### ✅ 2. Organization Guard
- [ ] Uses `orgScopedProcedure` for tRPC endpoints
- [ ] Verifies organization membership
- [ ] Verifies resource ownership (for update/delete)
- [ ] Permission checks using `requirePermissionProcedure()`

### ✅ 3. Pagination
- [ ] List endpoints use `paginationSchema`
- [ ] Returns pagination metadata
- [ ] Implements skip/take correctly

### ✅ 4. Soft-Delete
- [ ] Uses `deletedAt` field (no hard deletes)
- [ ] Queries filter `deletedAt: null`
- [ ] Schema includes `deletedAt DateTime?`

### ✅ 5. Audit Entries
- [ ] `recordAudit()` called for create operations
- [ ] `recordAudit()` called for update operations (with before/after)
- [ ] `recordAudit()` called for delete operations
- [ ] Audit includes correlation ID

### ✅ 6. Tests
- [ ] Unit tests added/updated
- [ ] API tests added/updated
- [ ] E2E tests added/updated (if UI feature)
- [ ] All tests passing
- [ ] Test coverage > 80% for new code

### ✅ 7. Documentation
- [ ] JSDoc comments added/updated
- [ ] Postman collection updated (if API change)
- [ ] README updated (if applicable)
- [ ] Migration guide (if schema change)

### ✅ 8. Seed Data
- [ ] Seed script updated
- [ ] Demo Org has sample data
- [ ] Seed is idempotent

## Testing

- [ ] Manual testing completed
- [ ] All automated tests passing
- [ ] Tested in demo environment

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Related Issues

<!-- Link related issues -->

Closes #

## Additional Notes

<!-- Any additional information -->

