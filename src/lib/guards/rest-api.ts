/**
 * REST API organization guards
 * Helper functions for Next.js API routes
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { verifyOrganizationMembership } from "./organization"

/**
 * Gets authenticated user session from request
 */
export async function getAuthSession(request: NextRequest) {
  // Convert NextRequest to IncomingMessage for getServerSession
  const headers = new Headers(request.headers)
  const cookie = headers.get("cookie") || ""
  
  // Create a mock req/res object for getServerSession
  const req = {
    headers: Object.fromEntries(headers),
    cookies: Object.fromEntries(
      cookie.split("; ").map(c => {
        const [key, ...values] = c.split("=")
        return [key, values.join("=")]
      })
    ),
  } as any

  const res = {} as any
  
  return await getServerSession(req, res, authOptions)
}

/**
 * Middleware to verify organization access in REST API routes
 * Returns organizationId if valid, throws error otherwise
 */
export async function requireOrganizationAccess(
  request: NextRequest,
  organizationId?: string
): Promise<{ userId: string; organizationId: string }> {
  // Get session
  const session = await getAuthSession(request)
  
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED")
  }

  // Get organizationId from parameter, body, or query params
  let orgId = organizationId
  
  if (!orgId) {
    // Try to get from query params first (doesn't consume request body)
    const { searchParams } = new URL(request.url)
    orgId = searchParams.get("organizationId") || undefined
  }

  if (!orgId) {
    // Try to get from body (this will consume the body, so clone request if needed elsewhere)
    try {
      const clonedRequest = request.clone()
      const body = await clonedRequest.json().catch(() => ({}))
      orgId = body.organizationId
    } catch {
      // Body not JSON or already parsed
    }
  }

  if (!orgId) {
    throw new Error("BAD_REQUEST: organizationId is required")
  }

  // Verify membership
  await verifyOrganizationMembership(session.user.id, orgId)

  return {
    userId: session.user.id,
    organizationId: orgId,
  }
}

/**
 * Creates error response for REST API
 */
export function createErrorResponse(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    { error: message, success: false },
    { status }
  )
}

/**
 * Wraps API handler with organization guard
 */
export function withOrgGuard<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      await requireOrganizationAccess(request)
      return handler(request, ...args)
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return createErrorResponse("You must be logged in", 401)
      }
      if (error.message.startsWith("BAD_REQUEST")) {
        return createErrorResponse(error.message.split(": ")[1] || "Bad request", 400)
      }
      if (error.message.includes("do not have access")) {
        return createErrorResponse("You do not have access to this organization", 403)
      }
      return createErrorResponse(error.message || "Internal server error", 500)
    }
  }
}

