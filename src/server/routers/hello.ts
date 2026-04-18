/**
 * Hello Router - Sample router demonstrating all DoD criteria
 * 
 * This router serves as a reference implementation showing:
 * - Typed inputs/outputs (Zod + TypeScript)
 * - Organization guard (orgScopedProcedure)
 * - Permission checks (requirePermissionProcedure)
 * - Pagination (paginationSchema)
 * - Soft-delete filtering (deletedAt: null)
 * - Audit logging (recordAudit for operations)
 * - Input validation (Zod schemas)
 */

import { z } from "zod"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"

/**
 * Input schema for hello list query
 */
const helloListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  filter: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Input schema for creating a hello item
 */
const createHelloSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  message: z.string().max(500, "Message must be less than 500 characters").optional(),
  organizationId: z.string().min(1, "Organization ID is required"),
})

/**
 * Input schema for updating a hello item
 */
const updateHelloSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  message: z.string().max(500).optional(),
})

/**
 * Hello router demonstrating all DoD criteria
 */
export const helloRouter = createTRPCRouter({
  /**
   * Get all hello items (paginated)
   * 
   * Demonstrates:
   * - ✅ Typed inputs/outputs
   * - ✅ Organization guard
   * - ✅ Permission check
   * - ✅ Pagination
   * - ✅ Soft-delete filtering
   * - ✅ Input validation
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_VIEW))
    .input(helloListSchema)
    .query(async ({ ctx, input }) => {
      const { page, limit, sortBy, sortOrder, filter } = input

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
        deletedAt: null, // ✅ Soft-delete filter
      }

      // Apply filter if provided
      if (filter) {
        where.OR = [
          { name: { contains: filter, mode: "insensitive" } },
          { message: { contains: filter, mode: "insensitive" } },
        ]
      }

      // Execute paginated query
      const [items, total] = await Promise.all([
        prisma.helloItem.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: sortBy
            ? { [sortBy]: sortOrder || "desc" }
            : { createdAt: "desc" },
        }),
        prisma.helloItem.count({ where }),
      ])

      // ✅ Paginated response structure
      return {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get a single hello item by ID
   * 
   * Demonstrates:
   * - ✅ Typed inputs/outputs
   * - ✅ Organization guard
   * - ✅ Permission check
   * - ✅ Resource ownership verification
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      // ✅ Verify resource ownership
      await verifyResourceOwnership("helloItem", input.id, ctx.organizationId)

      const item = await prisma.helloItem.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null, // ✅ Soft-delete filter
        },
      })

      if (!item) {
        throw new Error("Hello item not found")
      }

      return item
    }),

  /**
   * Create a new hello item
   * 
   * Demonstrates:
   * - ✅ Typed inputs/outputs
   * - ✅ Organization guard
   * - ✅ Permission check
   * - ✅ Input validation
   * - ✅ Audit logging
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_EDIT))
    .input(createHelloSchema)
    .mutation(async ({ ctx, input }) => {
      // Create item
      const item = await prisma.helloItem.create({
        data: {
          name: input.name,
          message: input.message,
          organizationId: ctx.organizationId,
        },
      })

      // ✅ Audit logging
      await recordAudit({
        entity: "helloItem",
        entityId: item.id,
        action: "create",
        after: item,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
        },
      }).catch((error) => {
        // Log but don't fail
        ctx.logger?.warn("Audit recording failed", { error, itemId: item.id })
      })

      return item
    }),

  /**
   * Update a hello item
   * 
   * Demonstrates:
   * - ✅ Typed inputs/outputs
   * - ✅ Organization guard
   * - ✅ Permission check
   * - ✅ Resource ownership verification
   * - ✅ Input validation
   * - ✅ Audit logging (with before/after)
   */
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_EDIT))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      data: updateHelloSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // ✅ Verify resource ownership
      await verifyResourceOwnership("helloItem", input.id, ctx.organizationId)

      // Get before state for audit
      const before = await prisma.helloItem.findUnique({
        where: { id: input.id },
      })

      if (!before) {
        throw new Error("Hello item not found")
      }

      // Update item
      const after = await prisma.helloItem.update({
        where: { id: input.id },
        data: input.data,
      })

      // ✅ Audit logging with before/after
      await recordAudit({
        entity: "helloItem",
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
        ctx.logger?.warn("Audit recording failed", { error, itemId: input.id })
      })

      return after
    }),

  /**
   * Delete a hello item (soft delete)
   * 
   * Demonstrates:
   * - ✅ Typed inputs/outputs
   * - ✅ Organization guard
   * - ✅ Permission check
   * - ✅ Resource ownership verification
   * - ✅ Soft-delete (deletedAt)
   * - ✅ Audit logging
   */
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.ORGANIZATION_EDIT))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // ✅ Verify resource ownership
      await verifyResourceOwnership("helloItem", input.id, ctx.organizationId)

      // Get before state for audit
      const before = await prisma.helloItem.findUnique({
        where: { id: input.id },
      })

      if (!before) {
        throw new Error("Hello item not found")
      }

      // ✅ Soft delete (not hard delete)
      const item = await prisma.helloItem.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })

      // ✅ Audit logging
      await recordAudit({
        entity: "helloItem",
        entityId: input.id,
        action: "delete",
        before,
        after: item,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, itemId: input.id })
      })

      return item
    }),
})

