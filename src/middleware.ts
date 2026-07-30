import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/auth/signin(.*)',
  '/auth/signup(.*)',
  '/auth/forgot-password(.*)',
  '/auth/reset-password(.*)',
  '/auth/verify-email(.*)',
  '/api/auth/(.*)',
  '/api/webhooks/(.*)',
  // Reports only the caller's own connection metadata back to the caller.
  // Public because it must be observable from outside to answer whether the
  // edge forwards the client TCP source port that HMRC requires.
  '/api/diagnostics/edge-headers',
  // Public so it can be opened directly in a browser to diagnose the auth
  // chain. Returns only the caller's own identity and organisation names.
  '/api/diagnostics/whoami',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
