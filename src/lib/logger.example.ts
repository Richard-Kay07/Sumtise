/**
 * Logging Usage Examples
 * 
 * This file demonstrates how to use the logging system
 * throughout the Sumtise application.
 */

import { logger, createLogger, log, getCorrelationId } from "@/lib/logger"
import { orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"

// ============================================================================
// Example 1: Basic logging in tRPC router
// ============================================================================

export const invoicesRouter = {
  getAll: orgScopedProcedure
    .input(/* ... */)
    .query(async ({ ctx, input }) => {
      // Logger is available in context with correlation ID
      ctx.logger.info("Fetching invoices", {
        organizationId: ctx.organizationId,
        filters: input,
      })

      try {
        const invoices = await prisma.invoice.findMany({
          where: { organizationId: ctx.organizationId },
        })

        ctx.logger.info("Invoices fetched successfully", {
          count: invoices.length,
        })

        return invoices
      } catch (error) {
        ctx.logger.error("Failed to fetch invoices", error as Error, {
          organizationId: ctx.organizationId,
        })
        throw error
      }
    }),
}

// ============================================================================
// Example 2: Logging with context
// ============================================================================

export const createInvoiceExample = async (
  ctx: { logger: any; organizationId: string; correlationId: string },
  invoiceData: any
) => {
  // Log operation start
  ctx.logger.info("Creating invoice", {
    customerId: invoiceData.customerId,
    total: invoiceData.total,
  })

  try {
    const invoice = await prisma.invoice.create({
      data: invoiceData,
    })

    // Log success
    ctx.logger.info("Invoice created successfully", {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    })

    return invoice
  } catch (error) {
    // Log error with context
    ctx.logger.error("Failed to create invoice", error as Error, {
      customerId: invoiceData.customerId,
      total: invoiceData.total,
    })
    throw error
  }
}

// ============================================================================
// Example 3: Using structured log helpers
// ============================================================================

export const apiRouteExample = async (
  req: { method: string; path: string; headers: any },
  res: any
) => {
  const correlationId = getCorrelationId(req.headers)
  const startTime = Date.now()

  // Log request
  log.request(req.method, req.path, correlationId, {
    ip: req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
  })

  try {
    // Process request (placeholder)
    const result = await Promise.resolve({ success: true })

    // Log response
    log.response(req.method, req.path, 200, correlationId, {
      duration: Date.now() - startTime,
    })

    return result
  } catch (error) {
    // Log error response
    log.response(req.method, req.path, 500, correlationId, {
      error: (error as Error).message,
    })
    throw error
  }
}

// ============================================================================
// Example 4: Database query logging
// ============================================================================

export const queryExample = async (
  ctx: { logger: any; correlationId: string },
  accountId: string
) => {
  // Log query
  log.query("findMany", "Transaction", ctx.correlationId, {
    accountId,
    organizationId: ctx.organizationId,
  })

  const transactions = await prisma.transaction.findMany({
    where: { accountId },
  })

  ctx.logger.debug("Query completed", {
    resultCount: transactions.length,
  })

  return transactions
}

// ============================================================================
// Example 5: Permission logging
// ============================================================================

export const permissionCheckExample = async (
  ctx: { logger: any; correlationId: string; session: any; organizationId: string },
  permission: string
) => {
  // Permission check is automatically logged in requirePermissionProcedure
  // But you can also log manually:

  const { hasPermission } = await import("@/lib/permissions")
  const granted = await hasPermission(
    ctx.session.user.id,
    ctx.organizationId,
    permission as any
  )

  log.permission(
    ctx.session.user.id,
    ctx.organizationId,
    permission,
    granted,
    ctx.correlationId
  )

  return granted
}

// ============================================================================
// Example 6: Error logging with full context
// ============================================================================

export const errorHandlingExample = async (
  ctx: { logger: any; correlationId: string; organizationId: string },
  invoiceId: string
) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      ctx.logger.warn("Invoice not found", {
        invoiceId,
        organizationId: ctx.organizationId,
      })
      throw new Error("Invoice not found")
    }

    return invoice
  } catch (error) {
    // Log error with full context
    ctx.logger.error("Error fetching invoice", error as Error, {
      invoiceId,
      organizationId: ctx.organizationId,
      userId: ctx.session?.user?.id,
    })
    throw error
  }
}

// ============================================================================
// Example 7: Child logger with additional context
// ============================================================================

export const childLoggerExample = async (
  ctx: { logger: any; correlationId: string }
) => {
  // Create child logger with module context
  const moduleLogger = ctx.logger.child({
    module: "payment-processing",
    version: "1.0.0",
  })

  moduleLogger.info("Processing payment")
  // All logs from moduleLogger will include module and version

  // Create logger with user context
  const userLogger = ctx.logger.withUser({
    id: ctx.session.user.id,
    email: ctx.session.user.email,
  })

  userLogger.info("User action performed")
  // All logs from userLogger will include user info
}

// ============================================================================
// Example 8: Logging levels
// ============================================================================

export const logLevelsExample = (ctx: { logger: any }) => {
  // Debug - detailed information for debugging
  ctx.logger.debug("Detailed debug information", {
    variable1: "value1",
    variable2: "value2",
  })

  // Info - general informational messages
  ctx.logger.info("Operation completed successfully", {
    operation: "createInvoice",
    invoiceId: "inv-123",
  })

  // Warn - warning messages
  ctx.logger.warn("Potential issue detected", {
    issue: "Low balance",
    accountId: "acc-123",
  })

  // Error - error messages
  ctx.logger.error("Operation failed", new Error("Database connection failed"), {
    operation: "createInvoice",
    retryCount: 3,
  })
}

// ============================================================================
// Example 9: Logging in background jobs
// ============================================================================

export const backgroundJobExample = async () => {
  // Create logger with correlation ID for background job
  const jobLogger = createLogger()
  jobLogger.setCorrelationId(jobLogger.generateCorrelationId())

  jobLogger.info("Background job started", {
    jobType: "payment-processing",
    scheduledAt: new Date().toISOString(),
  })

  try {
    // Process job (placeholder)
    await Promise.resolve()

    jobLogger.info("Background job completed", {
      processedCount: 10,
    })
  } catch (error) {
    jobLogger.error("Background job failed", error as Error, {
      jobType: "payment-processing",
    })
    throw error
  }
}

// ============================================================================
// Example 10: Logging in API routes
// ============================================================================

export const apiRouteHandler = async (
  req: { method: string; url: string; headers: any },
  res: any
) => {
  const correlationId = getCorrelationId(req.headers)
  const routeLogger = createLogger(correlationId)
  const startTime = Date.now()

  routeLogger.info("API request received", {
    method: req.method,
    url: req.url,
    ip: req.headers["x-forwarded-for"],
  })

  try {
    // Handle request (placeholder)
    const result = await Promise.resolve({ success: true })

    routeLogger.info("API request completed", {
      statusCode: 200,
      duration: Date.now() - startTime,
    })

    return result
  } catch (error) {
    routeLogger.error("API request failed", error as Error, {
      method: req.method,
      url: req.url,
    })
    throw error
  }
}

