# Definition of Done - Quick Reference

**Every feature must meet ALL 8 criteria before it's "done".**

---

## ✅ Checklist

### 1. Typed Inputs/Outputs
- [ ] Zod schema for inputs
- [ ] TypeScript types for outputs
- [ ] No `any` types
- [ ] Exported from `@/types/schemas`

### 2. Organization Guard
- [ ] `orgScopedProcedure` used
- [ ] `verifyResourceOwnership()` for update/delete
- [ ] `requirePermissionProcedure()` for permissions

### 3. Pagination
- [ ] Uses `paginationSchema`
- [ ] Returns `{ items, pagination: { page, limit, total, pages } } }`
- [ ] Implements skip/take

### 4. Soft-Delete
- [ ] Uses `update({ deletedAt: new Date() })` not `delete()`
- [ ] Queries filter `deletedAt: null`
- [ ] Schema has `deletedAt DateTime?`

### 5. Audit Entries
- [ ] `recordAudit()` for create
- [ ] `recordAudit()` for update (with before/after)
- [ ] `recordAudit()` for delete
- [ ] Includes correlation ID

### 6. Tests
- [ ] Unit tests
- [ ] API tests
- [ ] E2E tests (if UI)
- [ ] All passing

### 7. Documentation
- [ ] JSDoc comments
- [ ] Postman collection updated
- [ ] README/docs updated

### 8. Seed Data
- [ ] Seed script updated
- [ ] Demo Org has data
- [ ] Idempotent

---

## 📝 Standard Pattern

```typescript
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
          where: { organizationId: ctx.organizationId, deletedAt: null },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        prisma.myModel.count({ where: { ... } }),
      ])
      return { items, pagination: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) } }
    }),

  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_CREATE))
    .input(createSchema.extend({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.myModel.create({ data: { ...input } })
      await recordAudit({ entity: "myModel", entityId: item.id, action: "create", after: item, organizationId: ctx.organizationId, userId: ctx.session.user.id, meta: { correlationId: ctx.correlationId } })
      return item
    }),

  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_EDIT))
    .input(z.object({ id: z.string(), organizationId: z.string(), data: updateSchema }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
      const before = await prisma.myModel.findUnique({ where: { id: input.id } })
      const after = await prisma.myModel.update({ where: { id: input.id }, data: input.data })
      await recordAudit({ entity: "myModel", entityId: input.id, action: "update", before, after, organizationId: ctx.organizationId, userId: ctx.session.user.id, meta: { correlationId: ctx.correlationId } })
      return after
    }),

  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.MY_RESOURCE_DELETE))
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await verifyResourceOwnership("myModel", input.id, ctx.organizationId)
      const item = await prisma.myModel.update({ where: { id: input.id }, data: { deletedAt: new Date() } })
      await recordAudit({ entity: "myModel", entityId: input.id, action: "delete", before: item, organizationId: ctx.organizationId, userId: ctx.session.user.id, meta: { correlationId: ctx.correlationId } })
      return item
    }),
})
```

---

## 📁 File Locations

| Check | File |
|-------|------|
| Schemas | `src/types/schemas.ts` |
| Guards | `src/lib/guards/organization.ts` |
| Permissions | `src/lib/permissions.ts` |
| Audit | `src/lib/audit.ts` |
| Tests | `tests/unit/`, `tests/api/`, `tests/e2e/` |
| Seed | `prisma/seed.ts`, `scripts/uat-initializer.ts` |

---

**See [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md) for complete details.**

