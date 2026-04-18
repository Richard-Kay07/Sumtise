# Logging Implementation Summary

**Version:** 1.0  
**Date:** January 2024

---

## Overview

A comprehensive logging system with correlation IDs has been implemented for the Sumtise application. This enables request tracing, debugging, and monitoring across all application layers.

---

## Features Implemented

### 1. **Structured Logging**
- **4 Log Levels**: DEBUG, INFO, WARN, ERROR
- **Structured Log Entries**: All logs include timestamp, level, correlation ID, and context
- **Configurable**: Environment-based log level (DEBUG in dev, INFO in production)

### 2. **Correlation IDs**
- **Automatic Generation**: Each request gets a unique correlation ID
- **Header Support**: Reads `x-correlation-id` or `x-request-id` from request headers
- **Request Tracing**: Correlation ID included in all logs for a request
- **Response Headers**: Correlation ID returned in response headers for client tracking

### 3. **Context-Aware Logging**
- **User Context**: Automatically includes user ID and email in logs
- **Organization Context**: Automatically includes organization ID and name
- **Request Context**: Includes method, path, IP, user agent
- **Custom Context**: Additional metadata can be added to any log

### 4. **Integration Points**

#### tRPC Integration
- Correlation ID automatically extracted from request headers
- Logger available in all tRPC procedures via `ctx.logger`
- Error logging integrated into tRPC error formatter
- Permission checks automatically logged

#### Next.js Middleware
- Correlation ID added to all requests via `src/middleware.ts`
- Ensures correlation ID is available throughout request lifecycle

#### Organization-Scoped Procedures
- Logger automatically enriched with user and organization context
- Permission checks logged with full context

---

## Files Created

### Core Files

1. **`src/lib/logger.ts`** (461 lines)
   - Main logging utility
   - Logger class with correlation ID support
   - Structured log helpers
   - Context-aware logging methods

2. **`src/lib/logger.example.ts`** (326 lines)
   - Comprehensive usage examples
   - 10 different usage scenarios
   - Best practices

3. **`src/middleware.ts`** (45 lines)
   - Next.js middleware for correlation ID injection
   - Adds correlation ID to request/response headers

### Modified Files

1. **`src/lib/trpc.ts`**
   - Added correlation ID extraction from request headers
   - Added logger to tRPC context
   - Enhanced error formatter with logging
   - Added logging to `orgScopedProcedure`
   - Added logging to `requirePermissionProcedure`

---

## Usage Examples

### Basic Usage in tRPC Router

```typescript
export const invoicesRouter = createTRPCRouter({
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(/* ... */)
    .query(async ({ ctx, input }) => {
      // Logger is automatically available with correlation ID
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
})
```

### Using Structured Log Helpers

```typescript
import { log, getCorrelationId } from "@/lib/logger"

// Log API request
log.request("GET", "/api/invoices", correlationId, {
  ip: req.headers["x-forwarded-for"],
})

// Log API response
log.response("GET", "/api/invoices", 200, correlationId, {
  duration: 150,
})

// Log database query
log.query("findMany", "Invoice", correlationId, {
  organizationId: "org-123",
})

// Log permission check
log.permission(userId, organizationId, "INVOICES_VIEW", true, correlationId)
```

### Creating Child Loggers

```typescript
// Logger with module context
const moduleLogger = ctx.logger.child({
  module: "payment-processing",
  version: "1.0.0",
})

moduleLogger.info("Processing payment")
// All logs include module and version

// Logger with user context
const userLogger = ctx.logger.withUser({
  id: ctx.session.user.id,
  email: ctx.session.user.email,
})

// Logger with organization context
const orgLogger = ctx.logger.withOrganization({
  id: organizationId,
  name: organizationName,
})
```

---

## Log Format

### Console Output Format

```
[2024-01-15T10:30:45.123Z] [INFO] [550e8400-e29b-41d4-a716-446655440000] Fetching invoices [user:user-123] [org:org-456] [ctx:{"organizationId":"org-456","filters":{}}]
```

### Log Entry Structure

```typescript
{
  correlationId: "550e8400-e29b-41d4-a716-446655440000",
  level: "INFO",
  message: "Fetching invoices",
  timestamp: "2024-01-15T10:30:45.123Z",
  context: {
    organizationId: "org-456",
    filters: { status: "SENT" }
  },
  user: {
    id: "user-123",
    email: "user@example.com"
  },
  organization: {
    id: "org-456",
    name: "Demo Org"
  },
  request: {
    method: "GET",
    path: "/api/invoices",
    ip: "192.168.1.1",
    userAgent: "Mozilla/5.0..."
  }
}
```

---

## Configuration

### Environment Variables

```env
# Log level (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO

# Include stack traces in error logs (default: true in dev, false in prod)
LOG_INCLUDE_STACK_TRACE=true
```

### Default Configuration

```typescript
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  console: true,
  includeStackTrace: process.env.NODE_ENV !== "production",
}
```

---

## Automatic Logging

The following operations are automatically logged:

1. **tRPC Errors**: All tRPC errors are logged with full context
2. **Organization Access**: Organization membership verification attempts
3. **Permission Checks**: All permission checks (granted/denied)
4. **Unauthorized Access**: Failed authentication attempts
5. **Missing Context**: Missing organizationId or other required context

---

## Correlation ID Flow

1. **Request Arrives**: Next.js middleware extracts or generates correlation ID
2. **Header Added**: Correlation ID added to request headers (`x-correlation-id`)
3. **tRPC Context**: Correlation ID extracted and logger created in tRPC context
4. **All Logs**: All logs for the request include the same correlation ID
5. **Response**: Correlation ID included in response headers for client tracking

---

## Benefits

### 1. **Request Tracing**
- Track all logs for a single request using correlation ID
- Debug issues by searching logs by correlation ID
- Understand request flow through the system

### 2. **Debugging**
- Structured logs with context make debugging easier
- Error logs include stack traces in development
- Permission checks logged for security auditing

### 3. **Monitoring**
- Log levels allow filtering by severity
- Context information helps identify patterns
- User/organization context helps track user actions

### 4. **Security Auditing**
- All permission checks logged
- Unauthorized access attempts logged
- User actions tracked with correlation IDs

---

## Future Enhancements

### Planned Features

1. **File Logging**: Write logs to files in addition to console
2. **External Services**: Integration with Sentry, CloudWatch, Datadog
3. **Log Aggregation**: Centralized log collection and analysis
4. **Performance Metrics**: Automatic duration tracking for operations
5. **Structured JSON**: Option to output logs as JSON for parsing

### Example: External Service Integration

```typescript
// Future: Sentry integration
if (process.env.SENTRY_DSN) {
  logger.output = (entry: LogEntry) => {
    // Output to console
    console.log(formatLog(entry))
    
    // Send to Sentry for errors
    if (entry.level === LogLevel.ERROR) {
      Sentry.captureException(entry.error, {
        tags: {
          correlationId: entry.correlationId,
          userId: entry.user?.id,
          organizationId: entry.organization?.id,
        },
        extra: entry.context,
      })
    }
  }
}
```

---

## Testing

### Manual Testing

1. **Check Console Output**: Verify logs appear in console with correlation IDs
2. **Check Headers**: Verify `x-correlation-id` in response headers
3. **Test Log Levels**: Verify DEBUG logs only appear in development
4. **Test Error Logging**: Verify errors are logged with stack traces

### Example Test

```typescript
// In a tRPC router
ctx.logger.debug("Debug message", { test: true })
ctx.logger.info("Info message", { test: true })
ctx.logger.warn("Warning message", { test: true })
ctx.logger.error("Error message", new Error("Test error"), { test: true })
```

---

## Summary

✅ **Structured logging** with 4 log levels (DEBUG, INFO, WARN, ERROR)  
✅ **Correlation IDs** for request tracing  
✅ **Context-aware logging** (user, organization, request)  
✅ **tRPC integration** with automatic logging  
✅ **Next.js middleware** for correlation ID injection  
✅ **Permission logging** for security auditing  
✅ **Error logging** with stack traces  
✅ **Structured log helpers** for common scenarios  
✅ **Child loggers** for additional context  
✅ **Comprehensive examples** and documentation  

The logging system is now fully integrated and ready for use throughout the application. All tRPC procedures have access to a logger with correlation ID, and all errors are automatically logged with full context.

