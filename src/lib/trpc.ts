import { initTRPC, TRPCError } from "@trpc/server"
import { type NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import superjson from "superjson"
import { ZodError } from "zod"
import { prisma } from "@/lib/prisma"
import { Permission, requirePermission, getUserRole } from "@/lib/permissions"
import { getCorrelationId, createLogger } from "@/lib/logger"

type CreateContextOptions = {
  userId: string | null
  correlationId?: string
  logger?: ReturnType<typeof createLogger>
}

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    userId: opts.userId,
    prisma,
    correlationId: opts.correlationId,
    logger: opts.logger,
  }
}

export const createTRPCContext = async (opts: { req: NextRequest }) => {
  const { userId } = auth()

  const correlationId = getCorrelationId(
    Object.fromEntries(opts.req.headers.entries()) as Record<string, string>
  )
  const logger = createLogger(correlationId)

  return createInnerTRPCContext({
    userId,
    correlationId,
    logger,
  })
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
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
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: { userId: ctx.userId },
  })
})

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed)

export const orgScopedProcedure = protectedProcedure.use(async ({ ctx, next, input }) => {
  const correlationId = ctx.correlationId || createLogger().generateCorrelationId()
  const logger = ctx.logger || createLogger(correlationId)

  if (!ctx.userId) {
    logger.warn("Unauthorized access attempt", { correlationId })
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  let organizationId: string | undefined

  if (typeof input === "object" && input !== null) {
    organizationId = (input as any).organizationId
  }

  if (!organizationId) {
    logger.warn("Missing organizationId in request", { correlationId, userId: ctx.userId })
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "organizationId is required",
    })
  }

  const { verifyOrganizationMembership } = await import("@/lib/guards/organization")
  try {
    await verifyOrganizationMembership(ctx.userId, organizationId)
  } catch (error) {
    logger.warn("Organization membership verification failed", {
      correlationId,
      userId: ctx.userId,
      organizationId,
    })
    throw error
  }

  const role = await getUserRole(ctx.userId, organizationId)
  if (!role) {
    logger.warn("User role not found", { correlationId, userId: ctx.userId, organizationId })
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this organization",
    })
  }

  const contextLogger = logger
    .withUser({ id: ctx.userId })
    .withOrganization({ id: organizationId })

  logger.debug("Organization access granted", {
    correlationId,
    userId: ctx.userId,
    organizationId,
    role,
  })

  return next({
    ctx: {
      userId: ctx.userId,
      organizationId,
      role,
      correlationId,
      logger: contextLogger,
    },
  })
})

export function requirePermissionProcedure(permission: Permission) {
  return async ({ ctx, next }: any) => {
    const logger = ctx.logger || createLogger(ctx.correlationId)

    if (!ctx.organizationId || !ctx.userId) {
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
      await requirePermission(ctx.userId, ctx.organizationId, permission)
      logger.debug("Permission granted", {
        correlationId: ctx.correlationId,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        permission,
        role: ctx.role,
      })
    } catch (error) {
      logger.warn("Permission denied", {
        correlationId: ctx.correlationId,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        permission,
        role: ctx.role,
      })
      throw error
    }

    return next({ ctx })
  }
}

export function requireAnyPermissionProcedure(permissions: Permission[]) {
  return async ({ ctx, next }: any) => {
    if (!ctx.organizationId || !ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Organization context required",
      })
    }

    const { requireAnyPermission } = await import("@/lib/permissions")
    await requireAnyPermission(ctx.userId, ctx.organizationId, permissions)

    return next({ ctx })
  }
}

const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({
    ctx: { userId: ctx.userId },
  })
})

export const adminProcedure = t.procedure.use(enforceUserIsAdmin)
