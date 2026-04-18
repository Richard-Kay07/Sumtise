/**
 * Next.js Middleware
 * 
 * Adds correlation ID to request headers for request tracing.
 * This ensures all requests have a correlation ID that can be
 * used throughout the request lifecycle.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Get or generate correlation ID
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    crypto.randomUUID()

  // Clone request headers
  const requestHeaders = new Headers(request.headers)
  
  // Add correlation ID to request headers
  requestHeaders.set("x-correlation-id", correlationId)

  // Create response with correlation ID in headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add correlation ID to response headers for client tracking
  response.headers.set("x-correlation-id", correlationId)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}

