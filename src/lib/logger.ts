/**
 * Logging Utility with Correlation IDs
 * 
 * Provides structured logging with correlation IDs for request tracing.
 * All logs include correlation ID, timestamp, level, and context.
 */

import { randomUUID } from "crypto"

// Fallback for environments without crypto
const generateUUID = () => {
  if (typeof randomUUID === "function") {
    return randomUUID()
  }
  // Fallback UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /**
   * Correlation ID for request tracing
   */
  correlationId: string

  /**
   * Log level
   */
  level: LogLevel

  /**
   * Log message
   */
  message: string

  /**
   * Timestamp
   */
  timestamp: string

  /**
   * Additional context/metadata
   */
  context?: Record<string, any>

  /**
   * Error object (if applicable)
   */
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }

  /**
   * User context (if available)
   */
  user?: {
    id: string
    email?: string
  }

  /**
   * Organization context (if available)
   */
  organization?: {
    id: string
    name?: string
  }

  /**
   * Request context (if available)
   */
  request?: {
    method?: string
    path?: string
    ip?: string
    userAgent?: string
  }
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Minimum log level to output
   */
  minLevel: LogLevel

  /**
   * Whether to output to console
   */
  console: boolean

  /**
   * Whether to output to file (future: implement file logging)
   */
  file?: boolean

  /**
   * Whether to include stack traces in error logs
   */
  includeStackTrace: boolean
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  console: true,
  includeStackTrace: process.env.NODE_ENV !== "production",
}

/**
 * Logger class
 */
class Logger {
  private config: LoggerConfig
  private correlationId: string | null = null

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Set correlation ID for current context
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | null {
    return this.correlationId
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return generateUUID()
  }

  /**
   * Format log entry for output
   */
  private formatLog(entry: LogEntry): string {
    const parts: string[] = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      `[${entry.correlationId}]`,
      entry.message,
    ]

    if (entry.user) {
      parts.push(`[user:${entry.user.id}]`)
    }

    if (entry.organization) {
      parts.push(`[org:${entry.organization.id}]`)
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(`[ctx:${JSON.stringify(entry.context)}]`)
    }

    if (entry.error) {
      parts.push(`[error:${entry.error.name}:${entry.error.message}]`)
      if (entry.error.stack && this.config.includeStackTrace) {
        parts.push(`\n${entry.error.stack}`)
      }
    }

    return parts.join(" ")
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    // Check if log level is sufficient
    const levelPriority = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
    }

    if (levelPriority[entry.level] < levelPriority[this.config.minLevel]) {
      return
    }

    // Format and output
    const formatted = this.formatLog(entry)

    if (this.config.console) {
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(formatted)
          break
        case LogLevel.INFO:
          console.info(formatted)
          break
        case LogLevel.WARN:
          console.warn(formatted)
          break
        case LogLevel.ERROR:
          console.error(formatted)
          break
      }
    }

    // Future: Add file logging, external logging service (e.g., Sentry, CloudWatch)
  }

  /**
   * Create log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const correlationId = this.correlationId || this.generateCorrelationId()

    const entry: LogEntry = {
      correlationId,
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      }
    }

    return entry
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    const entry = this.createEntry(LogLevel.DEBUG, message, context)
    this.output(entry)
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, any>): void {
    const entry = this.createEntry(LogLevel.INFO, message, context)
    this.output(entry)
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    const entry = this.createEntry(LogLevel.WARN, message, context)
    this.output(entry)
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    const entry = this.createEntry(LogLevel.ERROR, message, context, error)
    this.output(entry)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.config)
    childLogger.setCorrelationId(this.correlationId || this.generateCorrelationId())
    
    // Merge context into all logs
    const originalOutput = childLogger.output.bind(childLogger)
    childLogger.output = (entry: LogEntry) => {
      entry.context = { ...context, ...entry.context }
      originalOutput(entry)
    }

    return childLogger
  }

  /**
   * Create a logger with user context
   */
  withUser(user: { id: string; email?: string }): Logger {
    const userLogger = new Logger(this.config)
    userLogger.setCorrelationId(this.correlationId || this.generateCorrelationId())
    
    const originalOutput = userLogger.output.bind(userLogger)
    userLogger.output = (entry: LogEntry) => {
      entry.user = user
      originalOutput(entry)
    }

    return userLogger
  }

  /**
   * Create a logger with organization context
   */
  withOrganization(organization: { id: string; name?: string }): Logger {
    const orgLogger = new Logger(this.config)
    orgLogger.setCorrelationId(this.correlationId || this.generateCorrelationId())
    
    const originalOutput = orgLogger.output.bind(orgLogger)
    orgLogger.output = (entry: LogEntry) => {
      entry.organization = organization
      originalOutput(entry)
    }

    return orgLogger
  }

  /**
   * Create a logger with request context
   */
  withRequest(request: { method?: string; path?: string; ip?: string; userAgent?: string }): Logger {
    const requestLogger = new Logger(this.config)
    requestLogger.setCorrelationId(this.correlationId || this.generateCorrelationId())
    
    const originalOutput = requestLogger.output.bind(requestLogger)
    requestLogger.output = (entry: LogEntry) => {
      entry.request = request
      originalOutput(entry)
    }

    return requestLogger
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger()

/**
 * Create a logger with correlation ID
 */
export function createLogger(correlationId?: string): Logger {
  const newLogger = new Logger()
  if (correlationId) {
    newLogger.setCorrelationId(correlationId)
  } else {
    newLogger.setCorrelationId(newLogger.generateCorrelationId())
  }
  return newLogger
}

/**
 * Get correlation ID from request headers or generate new one
 */
export function getCorrelationId(headers: Record<string, string | string[] | undefined>): string {
  const correlationIdHeader = headers["x-correlation-id"] || headers["x-request-id"]
  
  if (correlationIdHeader) {
    return Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader
  }

  return generateUUID()
}

/**
 * Structured log helper for common scenarios
 */
export const log = {
  /**
   * Log API request
   */
  request: (method: string, path: string, correlationId: string, context?: Record<string, any>) => {
    logger.info(`API Request: ${method} ${path}`, {
      correlationId,
      method,
      path,
      ...context,
    })
  },

  /**
   * Log API response
   */
  response: (method: string, path: string, statusCode: number, correlationId: string, context?: Record<string, any>) => {
    logger.info(`API Response: ${method} ${path} ${statusCode}`, {
      correlationId,
      method,
      path,
      statusCode,
      ...context,
    })
  },

  /**
   * Log database query
   */
  query: (operation: string, model: string, correlationId: string, context?: Record<string, any>) => {
    logger.debug(`DB Query: ${operation} ${model}`, {
      correlationId,
      operation,
      model,
      ...context,
    })
  },

  /**
   * Log business operation
   */
  operation: (operation: string, correlationId: string, context?: Record<string, any>) => {
    logger.info(`Operation: ${operation}`, {
      correlationId,
      operation,
      ...context,
    })
  },

  /**
   * Log authentication event
   */
  auth: (event: string, correlationId: string, context?: Record<string, any>) => {
    logger.info(`Auth: ${event}`, {
      correlationId,
      event,
      ...context,
    })
  },

  /**
   * Log permission check
   */
  permission: (userId: string, organizationId: string, permission: string, granted: boolean, correlationId: string) => {
    logger.debug(`Permission Check: ${permission} ${granted ? "GRANTED" : "DENIED"}`, {
      correlationId,
      userId,
      organizationId,
      permission,
      granted,
    })
  },
}

