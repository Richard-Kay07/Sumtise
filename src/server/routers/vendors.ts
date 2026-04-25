/**
 * Vendors Router
 * 
 * CRUD operations for vendors with:
 * - Search and filtering (name, alias, email, phone, taxId, tags, active/archived, date range)
 * - Pagination
 * - Organization scoping
 * - Soft-delete
 * - Audit logging
 * - Outstanding bills check before delete
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema, createVendorSchema, updateVendorSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { Prisma } from "@prisma/client"

/**
 * Vendor list query schema with filters
 */
const vendorListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Search filters
  name: z.string().optional(),
  alias: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  // Status filters
  isActive: z.boolean().optional(),
  includeArchived: z.boolean().default(false), // Include soft-deleted
  // Date range filter
  createdAtFrom: z.union([z.date(), z.string()]).optional(),
  createdAtTo: z.union([z.date(), z.string()]).optional(),
  // Tags filter
  tags: z.array(z.string()).optional(),
  // Sort
  sortBy: z.enum(["name", "alias", "email", "createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Vendor detail response with counts
 */
type VendorDetailResponse = {
  id: string
  organizationId: string
  name: string
  alias: string | null
  email: string | null
  phone: string | null
  address: any
  taxId: string | null
  paymentTerms: number | null
  bankAccountNumber: string | null
  bankSortCode: string | null
  bankIBAN: string | null
  bankSWIFT: string | null
  bankName: string | null
  defaultExpenseAccountId: string | null
  taxScheme: string | null
  currency: string | null
  tags: string[]
  isActive: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
  // Joined counts
  billsCount: number
  totalOutstanding: Prisma.Decimal
  lastPaymentDate: Date | null
  defaultExpenseAccount?: {
    id: string
    code: string
    name: string
  } | null
}

export const vendorsRouter = createTRPCRouter({
  /**
   * Get all vendors with pagination and filters
   * 
   * Filters: name, alias, email, phone, taxId, tags, active/archived, createdAt range
   * Returns: Paginated list of vendors
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.VENDORS_VIEW))
    .input(vendorListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        name,
        alias,
        email,
        phone,
        taxId,
        isActive,
        includeArchived,
        createdAtFrom,
        createdAtTo,
        tags,
        sortBy,
        sortOrder,
      } = input

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
      }

      // Soft-delete filter (default: exclude deleted)
      if (!includeArchived) {
        where.deletedAt = null
      }

      // Active filter
      if (isActive !== undefined) {
        where.isActive = isActive
      }

      // Search filters (case-insensitive partial match)
      const searchConditions: any[] = []
      
      if (name) {
        searchConditions.push({
          OR: [
            { name: { contains: name, mode: "insensitive" } },
            { alias: { contains: name, mode: "insensitive" } },
          ],
        })
      }

      if (alias) {
        searchConditions.push({ alias: { contains: alias, mode: "insensitive" } })
      }

      if (email) {
        searchConditions.push({ email: { contains: email, mode: "insensitive" } })
      }

      if (phone) {
        searchConditions.push({ phone: { contains: phone, mode: "insensitive" } })
      }

      if (taxId) {
        searchConditions.push({ taxId: { contains: taxId, mode: "insensitive" } })
      }

      if (searchConditions.length > 0) {
        where.AND = searchConditions
      }

      // Date range filter
      if (createdAtFrom || createdAtTo) {
        where.createdAt = {}
        if (createdAtFrom) {
          const from = typeof createdAtFrom === "string" ? new Date(createdAtFrom) : createdAtFrom
          where.createdAt.gte = from
        }
        if (createdAtTo) {
          const to = typeof createdAtTo === "string" ? new Date(createdAtTo) : createdAtTo
          to.setHours(23, 59, 59, 999) // End of day
          where.createdAt.lte = to
        }
      }

      // Tags filter (array contains)
      if (tags && tags.length > 0) {
        where.tags = {
          hasSome: tags,
        }
      }

      // Determine sort
      const orderBy: any = {}
      if (sortBy) {
        orderBy[sortBy] = sortOrder || "desc"
      } else {
        orderBy.createdAt = "desc"
      }

      // Execute paginated query
      const [vendors, total] = await Promise.all([
        prisma.vendor.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          select: {
            id: true,
            organizationId: true,
            name: true,
            alias: true,
            email: true,
            phone: true,
            address: true,
            taxId: true,
            paymentTerms: true,
            bankAccountNumber: true,
            bankSortCode: true,
            bankIBAN: true,
            bankSWIFT: true,
            bankName: true,
            defaultExpenseAccountId: true,
            taxScheme: true,
            currency: true,
            tags: true,
            isActive: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.vendor.count({ where }),
      ])

      return {
        vendors,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get vendor by ID with joined counts
   * 
   * Returns: Vendor details with bills count, total outstanding, last payment date
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.VENDORS_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }): Promise<VendorDetailResponse> => {
      // Verify resource ownership
      await verifyResourceOwnership("vendor", input.id, ctx.organizationId)

      // Get vendor with default expense account
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          defaultExpenseAccount: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      })

      if (!vendor || vendor.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        })
      }

      // Get bills count and outstanding total
      const bills = await prisma.bill.findMany({
        where: {
          vendorId: vendor.id,
          organizationId: ctx.organizationId,
          status: {
            in: ["DRAFT", "RECEIVED", "APPROVED", "OVERDUE"], // Outstanding statuses
          },
        },
        select: {
          total: true,
        },
      })

      const billsCount = bills.length
      const totalOutstanding = bills.reduce(
        (sum, bill) => sum.plus(new Prisma.Decimal(bill.total.toString())),
        new Prisma.Decimal(0)
      )

      // Get last payment date
      const lastPayment = await prisma.payment.findFirst({
        where: {
          vendorId: vendor.id,
          organizationId: ctx.organizationId,
          status: "COMPLETED",
        },
        orderBy: {
          paymentDate: "desc",
        },
        select: {
          paymentDate: true,
        },
      })

      return {
        id: vendor.id,
        organizationId: vendor.organizationId,
        name: vendor.name,
        alias: vendor.alias,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        taxId: vendor.taxId,
        paymentTerms: vendor.paymentTerms,
        bankAccountNumber: vendor.bankAccountNumber,
        bankSortCode: vendor.bankSortCode,
        bankIBAN: vendor.bankIBAN,
        bankSWIFT: vendor.bankSWIFT,
        bankName: vendor.bankName,
        defaultExpenseAccountId: vendor.defaultExpenseAccountId,
        taxScheme: vendor.taxScheme,
        currency: vendor.currency,
        tags: vendor.tags,
        isActive: vendor.isActive,
        deletedAt: vendor.deletedAt,
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
        billsCount,
        totalOutstanding,
        lastPaymentDate: lastPayment?.paymentDate || null,
        defaultExpenseAccount: vendor.defaultExpenseAccount,
      }
    }),

  /**
   * Create a new vendor
   * 
   * Validates: Unique name within organization
   * Optional: defaultExpenseAccountId, taxScheme, currency, paymentTerms
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.VENDORS_CREATE))
    .input(createVendorSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, ...vendorData } = input

      // Check for unique name within organization
      const existingVendor = await prisma.vendor.findFirst({
        where: {
          organizationId: ctx.organizationId,
          name: vendorData.name,
          deletedAt: null, // Only check non-deleted vendors
        },
      })

      if (existingVendor) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A vendor with the name "${vendorData.name}" already exists in this organization`,
        })
      }

      // Validate default expense account if provided
      if (vendorData.defaultExpenseAccountId) {
        const account = await prisma.chartOfAccount.findUnique({
          where: {
            id: vendorData.defaultExpenseAccountId,
            organizationId: ctx.organizationId,
            isActive: true,
          },
        })

        if (!account) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Default expense account not found or inactive",
          })
        }

        if (account.type !== "EXPENSE") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Default expense account must be of type EXPENSE",
          })
        }
      }

      // Create vendor
      const vendor = await prisma.vendor.create({
        data: {
          ...vendorData,
          organizationId: ctx.organizationId,
          tags: vendorData.tags || [],
        },
      })

      // Record audit
      await recordAudit({
        entity: "vendor",
        entityId: vendor.id,
        action: "create",
        after: vendor,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, vendorId: vendor.id })
      })

      return vendor
    }),

  /**
   * Update a vendor
   * 
   * Protects: id, organizationId (immutable)
   * Prevents: Name collision with other vendors
   */
  update: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.VENDORS_EDIT))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      data: updateVendorSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("vendor", input.id, ctx.organizationId)

      // Get before state for audit
      const before = await prisma.vendor.findUnique({
        where: { id: input.id },
      })

      if (!before || before.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        })
      }

      // Check for name collision if name is being updated
      if (input.data.name && input.data.name !== before.name) {
        const existingVendor = await prisma.vendor.findFirst({
          where: {
            organizationId: ctx.organizationId,
            name: input.data.name,
            id: { not: input.id }, // Exclude current vendor
            deletedAt: null,
          },
        })

        if (existingVendor) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A vendor with the name "${input.data.name}" already exists in this organization`,
          })
        }
      }

      // Validate default expense account if being updated
      if (input.data.defaultExpenseAccountId !== undefined) {
        if (input.data.defaultExpenseAccountId) {
          const account = await prisma.chartOfAccount.findUnique({
            where: {
              id: input.data.defaultExpenseAccountId,
              organizationId: ctx.organizationId,
              isActive: true,
            },
          })

          if (!account) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Default expense account not found or inactive",
            })
          }

          if (account.type !== "EXPENSE") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Default expense account must be of type EXPENSE",
            })
          }
        }
      }

      // Remove immutable fields from update data
      const { id, organizationId, ...updateData } = input.data as any
      delete updateData.id
      delete updateData.organizationId

      // Update vendor
      const after = await prisma.vendor.update({
        where: { id: input.id },
        data: updateData,
      })

      // Record audit
      await recordAudit({
        entity: "vendor",
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
        ctx.logger?.warn("Audit recording failed", { error, vendorId: input.id })
      })

      return after
    }),

  /**
   * Delete a vendor (soft-delete)
   * 
   * Blocks deletion if outstanding bills > 0 unless force=true
   * Default behavior: force=false (block if outstanding bills exist)
   */
  delete: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.VENDORS_DELETE))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
      force: z.boolean().default(false), // Force delete even with outstanding bills
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("vendor", input.id, ctx.organizationId)

      // Get before state for audit
      const before = await prisma.vendor.findUnique({
        where: { id: input.id },
      })

      if (!before || before.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vendor not found",
        })
      }

      // Check for outstanding bills
      if (!input.force) {
        const outstandingBills = await prisma.bill.findMany({
          where: {
            vendorId: input.id,
            organizationId: ctx.organizationId,
            status: {
              in: ["DRAFT", "RECEIVED", "APPROVED", "OVERDUE"], // Outstanding statuses
            },
          },
        })

        if (outstandingBills.length > 0) {
          const totalOutstanding = outstandingBills.reduce(
            (sum, bill) => sum.plus(new Prisma.Decimal(bill.total.toString())),
            new Prisma.Decimal(0)
          )

          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot delete vendor with ${outstandingBills.length} outstanding bill(s) totaling ${totalOutstanding.toFixed(2)}. Set force=true to override.`,
          })
        }
      }

      // Soft delete
      const after = await prisma.vendor.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      })

      // Record audit
      await recordAudit({
        entity: "vendor",
        entityId: input.id,
        action: "delete",
        before,
        after,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          correlationId: ctx.correlationId,
          force: input.force,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, vendorId: input.id })
      })

      return after
    }),
})

