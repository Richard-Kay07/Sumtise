/**
 * Audit Trail Utility
 * 
 * Records audit logs for entity changes, following Sumtise core standards.
 * All audit logs are organization-scoped and include user context.
 */

import { prisma } from "@/lib/prisma"

/**
 * Entity types that can be audited
 */
export type AuditableEntity =
  | "invoice"
  | "bill"
  | "customer"
  | "vendor"
  | "transaction"
  | "payment"
  | "paymentRun"
  | "creditNote"
  | "debitNote"
  | "chartOfAccount"
  | "bankAccount"
  | "billAmendment"
  | "organization"
  | "user"
  | "settings"

/**
 * Common audit actions
 */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "send"
  | "cancel"
  | "process"
  | "reverse"
  | "export"
  | "import"
  | "lock"
  | "unlock"
  | "custom"

/**
 * Audit record options
 */
export interface AuditRecordOptions {
  /**
   * Entity type being audited
   */
  entity: AuditableEntity

  /**
   * ID of the entity being audited
   */
  entityId: string

  /**
   * Action performed
   */
  action: AuditAction | string

  /**
   * State before the change (optional, for updates)
   */
  before?: Record<string, any> | null

  /**
   * State after the change (optional, for creates/updates)
   */
  after?: Record<string, any> | null

  /**
   * Additional metadata (optional)
   */
  meta?: Record<string, any> | null

  /**
   * Organization ID (required for organization-scoped entities)
   */
  organizationId: string

  /**
   * User ID performing the action (from session)
   */
  userId: string

  /**
   * IP address of the user (optional)
   */
  ipAddress?: string

  /**
   * User agent string (optional)
   */
  userAgent?: string

  /**
   * Custom details/description (optional)
   */
  details?: string | null
}

/**
 * Record an audit trail entry
 * 
 * @param options - Audit record options
 * @returns The created audit log entry
 * 
 * @example
 * ```typescript
 * await recordAudit({
 *   entity: "invoice",
 *   entityId: invoice.id,
 *   action: "update",
 *   before: { status: "DRAFT", total: 1000 },
 *   after: { status: "SENT", total: 1000 },
 *   organizationId: ctx.organizationId,
 *   userId: ctx.session.user.id,
 *   details: "Invoice sent to customer",
 * })
 * ```
 */
export async function recordAudit(options: AuditRecordOptions) {
  const {
    entity,
    entityId,
    action,
    before,
    after,
    meta,
    organizationId,
    userId,
    ipAddress,
    userAgent,
    details,
  } = options

  // Build the resource string (entity:entityId)
  const resource = `${entity}:${entityId}`

  // Build details string from before/after comparison
  let detailsString = details || ""

  if (before && after) {
    // Compare before and after to highlight changes
    const changes: string[] = []
    
    for (const key in after) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push(
          `${key}: ${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}`
        )
      }
    }

    if (changes.length > 0) {
      detailsString = detailsString
        ? `${detailsString}\n\nChanges: ${changes.join(", ")}`
        : `Changes: ${changes.join(", ")}`
    }
  } else if (before && !after) {
    // Deletion
    detailsString = detailsString || `Deleted ${entity} ${entityId}`
  } else if (!before && after) {
    // Creation
    detailsString = detailsString || `Created ${entity} ${entityId}`
  }

  // Add metadata to details if present
  if (meta && Object.keys(meta).length > 0) {
    const metaString = Object.entries(meta)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ")
    detailsString = detailsString
      ? `${detailsString}\n\nMetadata: ${metaString}`
      : `Metadata: ${metaString}`
  }

  // Create audit log entry
  const auditLog = await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action: `${entity}.${action}`,
      resource,
      resourceId: entityId,
      details: detailsString || null,
      ipAddress: ipAddress || "unknown",
      userAgent: userAgent || "unknown",
      timestamp: new Date(), // Use timestamp field from schema
    },
  })

  return auditLog
}

/**
 * Record audit from tRPC context
 * 
 * Convenience wrapper that extracts organizationId and userId from tRPC context
 * 
 * @param ctx - tRPC context with session and organizationId
 * @param options - Audit record options (without organizationId and userId)
 * @returns The created audit log entry
 * 
 * @example
 * ```typescript
 * await recordAuditFromContext(ctx, {
 *   entity: "invoice",
 *   entityId: invoice.id,
 *   action: "update",
 *   before: oldInvoice,
 *   after: invoice,
 * })
 * ```
 */
export async function recordAuditFromContext(
  ctx: {
    userId: string
    organizationId?: string
  },
  options: Omit<AuditRecordOptions, "organizationId" | "userId"> & {
    organizationId?: string
    userId?: string
  }
) {
  if (!ctx.userId) {
    throw new Error("User session required for audit logging")
  }

  const organizationId = options.organizationId || ctx.organizationId
  if (!organizationId) {
    throw new Error("Organization ID required for audit logging")
  }

  return recordAudit({
    ...options,
    organizationId,
    userId: options.userId || ctx.userId,
  })
}

/**
 * Record audit for entity creation
 * 
 * @param options - Audit record options
 * @returns The created audit log entry
 */
export async function recordCreateAudit(
  options: Omit<AuditRecordOptions, "action" | "before"> & {
    after: Record<string, any>
  }
) {
  return recordAudit({
    ...options,
    action: "create",
    before: null,
  })
}

/**
 * Record audit for entity update
 * 
 * @param options - Audit record options
 * @returns The created audit log entry
 */
export async function recordUpdateAudit(
  options: AuditRecordOptions & {
    before: Record<string, any>
    after: Record<string, any>
  }
) {
  return recordAudit({
    ...options,
    action: "update",
  })
}

/**
 * Record audit for entity deletion
 * 
 * @param options - Audit record options
 * @returns The created audit log entry
 */
export async function recordDeleteAudit(
  options: Omit<AuditRecordOptions, "action" | "after"> & {
    before: Record<string, any>
  }
) {
  return recordAudit({
    ...options,
    action: "delete",
    after: null,
  })
}

/**
 * Get audit trail for an entity
 * 
 * @param organizationId - Organization ID
 * @param entity - Entity type
 * @param entityId - Entity ID
 * @param limit - Maximum number of records to return (default: 50)
 * @returns Array of audit log entries
 */
export async function getAuditTrail(
  organizationId: string,
  entity: AuditableEntity,
  entityId: string,
  limit: number = 50
) {
  const resource = `${entity}:${entityId}`

  return await prisma.auditLog.findMany({
    where: {
      organizationId,
      resource,
      resourceId: entityId,
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

/**
 * Get audit trail for an organization (all entities)
 * 
 * @param organizationId - Organization ID
 * @param filters - Optional filters
 * @param pagination - Pagination options
 * @returns Paginated audit log entries
 */
export async function getOrganizationAuditTrail(
  organizationId: string,
  filters?: {
    entity?: AuditableEntity
    action?: string
    userId?: string
    startDate?: Date
    endDate?: Date
  },
  pagination?: {
    page: number
    limit: number
  }
) {
  const where: any = {
    organizationId,
  }

  if (filters?.entity) {
    where.resource = {
      startsWith: `${filters.entity}:`,
    }
  }

  if (filters?.action) {
    where.action = {
      contains: filters.action,
    }
  }

  if (filters?.userId) {
    where.userId = filters.userId
  }

  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {}
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      endDate.setHours(23, 59, 59, 999)
      where.timestamp.lte = endDate
    }
  }

  const page = pagination?.page || 1
  const limit = pagination?.limit || 20
  const skip = (page - 1) * limit

  const [auditLogs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: "desc",
      },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    auditLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

