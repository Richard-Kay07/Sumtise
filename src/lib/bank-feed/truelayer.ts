import { prisma } from '@/lib/prisma'

const TRUELAYER_BASE = process.env.TRUELAYER_BASE_URL ?? 'https://api.truelayer-sandbox.com'
const TRUELAYER_AUTH = process.env.TRUELAYER_AUTH_URL ?? 'https://auth.truelayer-sandbox.com'
const CLIENT_ID = process.env.TRUELAYER_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.TRUELAYER_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.TRUELAYER_REDIRECT_URI ?? ''

export function getConnectUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'info accounts balance cards transactions offline_access',
    redirect_uri: REDIRECT_URI,
    providers: 'uk-ob-all uk-oauth-all',
    state,
  })
  return `${TRUELAYER_AUTH}/?${params}`
}

interface TruelayerTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export async function exchangeCode(code: string): Promise<TruelayerTokenResponse> {
  const res = await fetch(`${TRUELAYER_AUTH}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  })
  if (!res.ok) throw new Error(`TrueLayer code exchange failed: ${res.status}`)
  return res.json()
}

async function refreshToken(bankAccountId: string): Promise<string> {
  const conn = await prisma.bankFeedConnection.findUnique({ where: { bankAccountId } })
  if (!conn) throw new Error('No bank feed connection found')

  if (conn.expiresAt > new Date(Date.now() + 60_000)) return conn.accessToken

  const res = await fetch(`${TRUELAYER_AUTH}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: conn.refreshToken,
    }),
  })

  if (!res.ok) {
    await prisma.bankFeedConnection.update({
      where: { bankAccountId },
      data: { status: 'RECONNECT_REQUIRED', errorMessage: `Token refresh failed: ${res.status}` },
    })
    throw new Error(`TrueLayer token refresh failed: ${res.status}`)
  }

  const tokens: TruelayerTokenResponse = await res.json()
  await prisma.bankFeedConnection.update({
    where: { bankAccountId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: 'ACTIVE',
    },
  })

  return tokens.access_token
}

interface TruelayerTransaction {
  transaction_id: string
  timestamp: string
  description: string
  transaction_type: string
  amount: number
  currency: string
  merchant_name?: string
  meta?: Record<string, unknown>
}

export async function syncTransactions(bankAccountId: string, organizationId: string): Promise<number> {
  const conn = await prisma.bankFeedConnection.findUnique({ where: { bankAccountId } })
  if (!conn?.providerAccountId) throw new Error('No provider account ID stored')

  const token = await refreshToken(bankAccountId)
  const fromDate = conn.lastSyncedAt
    ? conn.lastSyncedAt.toISOString().split('T')[0]
    : (conn.syncFromDate ?? new Date(Date.now() - 90 * 86400000)).toISOString().split('T')[0]

  const toDate = new Date().toISOString().split('T')[0]

  const res = await fetch(
    `${TRUELAYER_BASE}/data/v1/accounts/${conn.providerAccountId}/transactions?from=${fromDate}&to=${toDate}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    await prisma.bankFeedConnection.update({
      where: { bankAccountId },
      data: { errorMessage: `Sync failed: ${res.status}` },
    })
    throw new Error(`TrueLayer sync failed: ${res.status}`)
  }

  const { results }: { results: TruelayerTransaction[] } = await res.json()
  let created = 0

  for (const tx of results) {
    const existing = await prisma.bankTransaction.findFirst({
      where: { bankAccountId, feedTxId: tx.transaction_id },
    })
    if (existing) continue

    await prisma.bankTransaction.create({
      data: {
        organizationId,
        bankAccountId,
        date: new Date(tx.timestamp),
        amount: tx.amount,
        description: tx.description,
        payee: tx.merchant_name ?? null,
        type: tx.transaction_type,
        sourceType: 'FEED',
        feedTxId: tx.transaction_id,
        metadata: tx.meta as any,
      },
    })
    created++
  }

  await prisma.bankFeedConnection.update({
    where: { bankAccountId },
    data: {
      lastSyncedAt: new Date(),
      lastSuccessAt: new Date(),
      syncCount: { increment: 1 },
      errorMessage: null,
    },
  })

  return created
}
