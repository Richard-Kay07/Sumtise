import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { TRPCError } from "@trpc/server"

export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: any) {
    super(message, 400)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429)
  }
}

export function handleError(error: unknown): NextResponse {
  console.error("Error occurred:", error)

  // Handle known error types
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          statusCode: error.statusCode,
          ...(error instanceof ValidationError && { details: error.details })
        }
      },
      { status: error.statusCode }
    )
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: "Validation failed",
          statusCode: 400,
          details: error.flatten()
        }
      },
      { status: 400 }
    )
  }

  // Handle tRPC errors
  if (error instanceof TRPCError) {
    const statusCode = getTRPCStatusCode(error.code)
    return NextResponse.json(
      {
        error: {
          message: error.message,
          statusCode,
          code: error.code
        }
      },
      { status: statusCode }
    )
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as any
    switch (prismaError.code) {
      case "P2002":
        return NextResponse.json(
          {
            error: {
              message: "A record with this information already exists",
              statusCode: 409
            }
          },
          { status: 409 }
        )
      case "P2025":
        return NextResponse.json(
          {
            error: {
              message: "Record not found",
              statusCode: 404
            }
          },
          { status: 404 }
        )
      case "P2003":
        return NextResponse.json(
          {
            error: {
              message: "Foreign key constraint failed",
              statusCode: 400
            }
          },
          { status: 400 }
        )
    }
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : "An unexpected error occurred"
  
  return NextResponse.json(
    {
      error: {
        message: process.env.NODE_ENV === "production" 
          ? "An unexpected error occurred" 
          : message,
        statusCode: 500
      }
    },
    { status: 500 }
  )
}

function getTRPCStatusCode(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401
    case "FORBIDDEN":
      return 403
    case "NOT_FOUND":
      return 404
    case "METHOD_NOT_SUPPORTED":
      return 405
    case "TIMEOUT":
      return 408
    case "CONFLICT":
      return 409
    case "PRECONDITION_FAILED":
      return 412
    case "PAYLOAD_TOO_LARGE":
      return 413
    case "UNPROCESSABLE_CONTENT":
      return 422
    case "TOO_MANY_REQUESTS":
      return 429
    case "CLIENT_CLOSED_REQUEST":
      return 499
    case "INTERNAL_SERVER_ERROR":
    default:
      return 500
  }
}

// Rate limiting middleware
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return (request: NextRequest): boolean => {
    const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown"
    const now = Date.now()
    const windowStart = now - windowMs

    // Clean up old entries
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key)
      }
    }

    const current = requests.get(ip)
    
    if (!current) {
      requests.set(ip, { count: 1, resetTime: now })
      return true
    }

    if (current.resetTime < windowStart) {
      requests.set(ip, { count: 1, resetTime: now })
      return true
    }

    if (current.count >= maxRequests) {
      return false
    }

    current.count++
    return true
  }
}

// Request logging middleware
export function logRequest(request: NextRequest) {
  const { method, url } = request
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  
  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${ip} - ${userAgent}`)
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }
  
  return response
}
