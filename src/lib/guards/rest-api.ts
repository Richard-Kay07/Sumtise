import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { verifyOrganizationMembership } from "./organization"

export async function requireOrganizationAccess(
  request: NextRequest,
  organizationId?: string
): Promise<{ userId: string; organizationId: string }> {
  const { userId } = auth()

  if (!userId) {
    throw new Error("UNAUTHORIZED")
  }

  let orgId = organizationId

  if (!orgId) {
    const { searchParams } = new URL(request.url)
    orgId = searchParams.get("organizationId") || undefined
  }

  if (!orgId) {
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

  await verifyOrganizationMembership(userId, orgId)

  return { userId, organizationId: orgId }
}

export function createErrorResponse(
  message: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    { error: message, success: false },
    { status }
  )
}

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
