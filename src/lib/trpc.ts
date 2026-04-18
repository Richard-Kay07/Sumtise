import { initTRPC, TRPCError } from "@trpc/server"
import { type CreateNextContextOptions } from "@trpc/server/adapters/next"
import { type Session } from "next-auth"
import superjson from "superjson"
import { ZodError } from "zod"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Permission, requirePermission, getUserRole } from "@/lib/permissions"
import { getCorrelationId, createLogger } from "@/lib/logger"

type CreateContextOptions = {
  session: Session | null
  correlationId?: string
  logger?: ReturnType<typeof createLogger>
}

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
    correlationId: opts.correlationId,
    logger: opts.logger,
  }
}

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts
  const session = await getServerSession(req, res, authOptions)

  // Get or generate correlation ID
  const correlationId = getCorrelationId(req.headers as Record<string, string | string[] | undefined>)
  
  // Create logger with correlation ID
  const logger = createLogger(correlationId)

  return createInnerTRPCContext({
    session,
    correlationId,
    logger,
  })
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    // Log errors
    if (ctx?.logger) {
      ctx.logger.error("tRPC Error", error as Error, {
        code: shape.data.code,
        httpStatus: shape.data.httpStatus,
      })
    }

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
        correlationId: ctx?.correlationId,
      },
    }
  },
})

export const createTRPCRouter = t.router

export const publicProcedure = t.procedure

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

/**
 * Organization-scoped procedure: Verifies user has access to the organization
 * Input must contain organizationId field
 * 
 * Note: Input validation happens after this middleware, so we use a wrapper
 * that validates organizationId after input schema validation
 */
export const orgScopedProcedure = protectedProcedure.use(async ({ ctx, next, input, rawInput }) => {
  const correlationId = ctx.correlationId || createLogger().generateCorrelationId()
  const logger = ctx.logger || createLogger(correlationId)

  if (!ctx.session || !ctx.session.user) {
    logger.warn("Unauthorized access attempt", { correlationId })
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  // Extract organizationId from input (after schema validation)
  let organizationId: string | undefined
  
  if (typeof input === "object" && input !== null) {
    organizationId = (input as any).organizationId
  }

  if (!organizationId) {
    logger.warn("Missing organizationId in request", {
      correlationId,
      userId: ctx.session.user.id,
    })
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "organizationId is required",
    })
  }

  // Verify user is a member of the organization
  const { verifyOrganizationMembership } = await import("@/lib/guards/organization")
  try {
    await verifyOrganizationMembership(ctx.session.user.id, organizationId)
  } catch (error) {
    logger.warn("Organization membership verification failed", {
      correlationId,
      userId: ctx.session.user.id,
      organizationId,
    })
    throw error
  }

  // Get user's role in the organization
  const role = await getUserRole(ctx.session.user.id, organizationId)
  if (!role) {
    logger.warn("User role not found", {
      correlationId,
      userId: ctx.session.user.id,
      organizationId,
    })
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this organization",
    })
  }

  // Create logger with user and organization context
  const contextLogger = logger
    .withUser({ id: ctx.session.user.id, email: ctx.session.user.email || undefined })
    .withOrganization({ id: organizationId })

  logger.debug("Organization access granted", {
    correlationId,
    userId: ctx.session.user.id,
    organizationId,
    role,
  })

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      organizationId,
      role, // Include role in context for permission checks
      correlationId,
      logger: contextLogger,
    },
  })
})

/**
 * Permission-required procedure: Requires specific permission(s)
 * Must be used after orgScopedProcedure
 * 
 * @example
 * ```typescript
 * export const myRouter = createTRPCRouter({
 *   create: orgScopedProcedure
 *     .use(requirePermissionProcedure(Permission.INVOICES_CREATE))
 *     .input(createInvoiceSchema)
 *     .mutation(async ({ ctx, input }) => {
 *       // ctx.role is available
 *       // Permission already checked
 *     }),
 * })
 * ```
 */
export function requirePermissionProcedure(permission: Permission) {
  return async ({ ctx, next }: any) => {
    const logger = ctx.logger || createLogger(ctx.correlationId)

    if (!ctx.organizationId || !ctx.session?.user?.id) {
      logger.warn("Permission check failed: missing context", {
        correlationId: ctx.correlationId,
        permission,
      })
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Organization context required",
      })
    }

    try {
      await requirePermission(
        ctx.session.user.id,
        ctx.organizationId,
        permission
      )

      logger.debug("Permission granted", {
        correlationId: ctx.correlationId,
        userId: ctx.session.user.id,
        organizationId: ctx.organizationId,
        permission,
        role: ctx.role,
      })
    } catch (error) {
      logger.warn("Permission denied", {
        correlationId: ctx.correlationId,
        userId: ctx.session.user.id,
        organizationId: ctx.organizationId,
        permission,
        role: ctx.role,
      })
      throw error
    }

    return next({ ctx })
  }
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermissionProcedure(permissions: Permission[]) {
  return async ({ ctx, next }: any) => {
    if (!ctx.organizationId || !ctx.session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Organization context required",
      })
    }

    const { requireAnyPermission } = await import("@/lib/permissions")
    await requireAnyPermission(
      ctx.session.user.id,
      ctx.organizationId,
      permissions
    )

    return next({ ctx })
  }
}


const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  
  // Add organization role check here
  // For now, we'll assume all authenticated users are admins
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  })
})

export const adminProcedure = t.procedure.use(enforceUserIsAdmin)
