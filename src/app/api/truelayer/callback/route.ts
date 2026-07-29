import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { publicUrl } from '@/lib/public-url'
import { exchangeCode } from '@/lib/bank-feed/truelayer'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.redirect(publicUrl('/auth/signin', req.headers))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  // state = organizationId:bankAccountId
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(publicUrl(`/accounting/ledger-banking?feed_error=${encodeURIComponent(error)}`, req.headers))
  }

  if (!code || !state) {
    return NextResponse.redirect(publicUrl('/accounting/ledger-banking?feed_error=missing_params', req.headers))
  }

  const [organizationId, bankAccountId] = state.split(':')
  if (!organizationId || !bankAccountId) {
    return NextResponse.redirect(publicUrl('/accounting/ledger-banking?feed_error=invalid_state', req.headers))
  }

  try {
    const tokens = await exchangeCode(code)

    await prisma.bankFeedConnection.upsert({
      where: { bankAccountId },
      create: {
        organizationId,
        bankAccountId,
        provider: 'TRUELAYER',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: 'ACTIVE',
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: 'ACTIVE',
        errorMessage: null,
      },
    })

    return NextResponse.redirect(publicUrl('/accounting/ledger-banking?feed_connected=1', req.headers))
  } catch (err) {
    console.error('[TrueLayer callback] failed:', err)
    return NextResponse.redirect(publicUrl('/accounting/ledger-banking?feed_error=token_exchange_failed', req.headers))
  }
}
