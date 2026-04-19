import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/auth/signin(.*)",
  "/auth/signup(.*)",
  "/api/webhooks(.*)",
])

export default clerkMiddleware((auth, request) => {
  const correlationId =
    request.headers.get("x-correlation-id") || crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-correlation-id", correlationId)

  if (!isPublicRoute(request)) {
    auth().protect()
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("x-correlation-id", correlationId)
  return response
})

export const config = {
  matcher: [
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
}
