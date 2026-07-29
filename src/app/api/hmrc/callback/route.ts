import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens, storeHmrcConnection } from '@/lib/hmrc/oauth'
import { verifyOAuthState } from '@/lib/hmrc/state'
import { verifyOrganizationMembership } from '@/lib/guards/organization'
import { requirePermission, Permission } from '@/lib/permissions'
import { publicUrl } from '@/lib/public-url'

export const dynamic = 'force-dynamic'

const RETURN_PATH = '/tax/settings'

function fail(req: NextRequest, reason: string) {
  // publicUrl, not req.url — see src/lib/public-url.ts. req.url resolves to the
  // internal bind address (0.0.0.0:8080 on Railway) and redirecting a browser
  // there fails with ERR_CONNECTION_REFUSED.
  return NextResponse.redirect(
    publicUrl(`${RETURN_PATH}?hmrc_error=${encodeURIComponent(reason)}`, req.headers),
  )
}

export async function GET(req: NextRequest) {
  // Wrap everything: verifyOAuthState throws if HMRC_STATE_SECRET is missing,
  // and an unhandled throw here renders a stack trace instead of redirecting.
  try {
    // Clerk's types declare auth() as async; awaiting is safe either way.
    const { userId } = await auth()
    if (!userId) return NextResponse.redirect(publicUrl('/auth/signin', req.headers))

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) return fail(req, error)
    if (!code || !state) return fail(req, 'missing_params')

    // The state is HMAC-signed and time-limited. Never trust it as a bare
    // organisation ID — that would let anyone bind HMRC tokens to another tenant.
    const verified = verifyOAuthState(state)
    if (!verified.ok) return fail(req, `invalid_state_${verified.reason}`)

    // The person finishing the flow must be the person who started it.
    if (verified.userId !== userId) return fail(req, 'state_user_mismatch')

    // ...and must still be a member of the organisation being connected.
    try {
      await verifyOrganizationMembership(userId, verified.organizationId)
    } catch {
      return fail(req, 'not_a_member')
    }

    // Re-check the permission the mutation required. The signed state proves
    // they had it 15 minutes ago; it does not prove they still do, and relying
    // on that would let a demoted user — or anyone who could forge state —
    // overwrite the organisation's HMRC credentials.
    try {
      await requirePermission(userId, verified.organizationId, Permission.SETTINGS_EDIT)
    } catch {
      return fail(req, 'insufficient_permissions')
    }

    try {
      const tokens = await exchangeCodeForTokens(code)
      await storeHmrcConnection(verified.organizationId, tokens)
      // The VRN is not part of the token response and must be captured
      // separately, so send the user somewhere that prompts for it.
      return NextResponse.redirect(publicUrl(`${RETURN_PATH}?hmrc_connected=1`, req.headers))
    } catch (err) {
      console.error('[HMRC callback] token exchange failed:', err)
      return fail(req, 'token_exchange_failed')
    }
  } catch (err) {
    console.error('[HMRC callback] unexpected error:', err)
    return fail(req, 'internal_error')
  }
}
