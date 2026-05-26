import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { exchangeCode } from '@/lib/bank-feed/truelayer'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { userId } = auth()
  if (!userId) return NextResponse.redirect(new URL('/auth/signin', req.url))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  // state = organizationId:bankAccountId
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/accounting/ledger-banking?feed_error=${encodeURIComponent(error)}`, req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/accounting/ledger-banking?feed_error=missing_params', req.url))
  }

  const [organizationId, bankAccountId] = state.split(':')
  if (!organizationId || !bankAccountId) {
    return NextResponse.redirect(new URL('/accounting/ledger-banking?feed_error=invalid_state', req.url))
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

    return NextResponse.redirect(new URL('/accounting/ledger-banking?feed_connected=1', req.url))
  } catch (err) {
    console.error('[TrueLayer callback] failed:', err)
    return NextResponse.redirect(new URL('/accounting/ledger-banking?feed_error=token_exchange_failed', req.url))
  }
}
