import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCodeForTokens, storeHmrcConnection } from '@/lib/hmrc/oauth'

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.redirect(new URL('/auth/signin', req.url))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // organizationId encoded in state
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/settings/integrations?hmrc_error=${encodeURIComponent(error)}`, req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings/integrations?hmrc_error=missing_params', req.url))
  }

  const organizationId = state

  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeHmrcConnection(organizationId, tokens)
    return NextResponse.redirect(new URL('/settings/integrations?hmrc_connected=1', req.url))
  } catch (err) {
    console.error('[HMRC callback] token exchange failed:', err)
    return NextResponse.redirect(new URL(`/settings/integrations?hmrc_error=token_exchange_failed`, req.url))
  }
}
