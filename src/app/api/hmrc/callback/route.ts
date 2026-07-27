import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens, storeHmrcConnection } from '@/lib/hmrc/oauth'
import { verifyOAuthState } from '@/lib/hmrc/state'
import { verifyOrganizationMembership } from '@/lib/guards/organization'

const RETURN_PATH = '/tax/settings'

function fail(req: NextRequest, reason: string) {
  return NextResponse.redirect(
    new URL(`${RETURN_PATH}?hmrc_error=${encodeURIComponent(reason)}`, req.url),
  )
}

export async function GET(req: NextRequest) {
  // Clerk's types declare auth() as async; awaiting is safe either way.
  const { userId } = await auth()
  if (!userId) return NextResponse.redirect(new URL('/auth/signin', req.url))

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

  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeHmrcConnection(verified.organizationId, tokens)
    // The VRN is not part of the token response and must be captured
    // separately, so send the user somewhere that prompts for it.
    return NextResponse.redirect(new URL(`${RETURN_PATH}?hmrc_connected=1`, req.url))
  } catch (err) {
    console.error('[HMRC callback] token exchange failed:', err)
    return fail(req, 'token_exchange_failed')
  }
}
