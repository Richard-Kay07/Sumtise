import { prisma } from '@/lib/prisma'
import { sealToken, openToken } from '@/lib/crypto/tokens'

const HMRC_BASE_URL = process.env.HMRC_BASE_URL ?? 'https://test-api.service.hmrc.gov.uk'
const CLIENT_ID = process.env.HMRC_CLIENT_ID ?? ''
const CLIENT_SECRET = process.env.HMRC_CLIENT_SECRET ?? ''
const REDIRECT_URI = process.env.HMRC_REDIRECT_URI ?? ''

export interface HmrcTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope?: string
}

/**
 * The browser-facing authorize endpoint is NOT on the API host.
 * HMRC serves /oauth/authorize from www.tax.service.gov.uk (test-www in
 * sandbox), while /oauth/token is on the api host. Pointing the browser at
 * the API host breaks the consent journey.
 */
function authorizeHost(): string {
  const isProduction = HMRC_BASE_URL.includes('//api.service.hmrc.gov.uk')
  return process.env.HMRC_AUTHORIZE_URL ??
    (isProduction
      ? 'https://www.tax.service.gov.uk'
      : 'https://test-www.tax.service.gov.uk')
}

export function getAuthorizationUrl(state: string): string {
  if (!CLIENT_ID) {
    // Empty-string defaults would otherwise produce a valid-looking URL with a
    // blank client_id, failing confusingly at HMRC instead of here.
    throw new Error('HMRC_CLIENT_ID is not configured.')
  }
  if (!REDIRECT_URI) {
    throw new Error('HMRC_REDIRECT_URI is not configured.')
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: process.env.HMRC_SCOPE ?? 'read:vat write:vat',
    redirect_uri: REDIRECT_URI,
    state,
  })
  return `${authorizeHost()}/oauth/authorize?${params}`
}

export async function exchangeCodeForTokens(code: string): Promise<HmrcTokenResponse> {
  const res = await fetch(`${HMRC_BASE_URL}/oauth/token`, {
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
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HMRC token exchange failed: ${res.status} ${body}`)
  }
  return res.json() as Promise<HmrcTokenResponse>
}

/**
 * In-process coalescing so a single Node process never issues two concurrent
 * refreshes for the same organisation. The advisory lock below handles the
 * cross-process case; this avoids the round trip entirely in the common one.
 */
const inFlightRefreshes = new Map<string, Promise<string>>()

/**
 * Exchange the refresh token for a new access token.
 *
 * HMRC refresh tokens are SINGLE-USE and issuing a new one immediately
 * invalidates the previous access token. Two concurrent refreshes therefore
 * race destructively: the loser can persist a refresh token HMRC has already
 * revoked, permanently bricking the connection and forcing a full
 * re-authorisation — potentially on a VAT deadline day.
 *
 * This is serialised three ways:
 *  1. in-process promise coalescing (below),
 *  2. a Postgres advisory lock held for the transaction, and
 *  3. a compare-and-swap on the refresh token, so a stale writer cannot
 *     clobber a newer successful refresh.
 */
export async function refreshAccessToken(organizationId: string): Promise<string> {
  const existing = inFlightRefreshes.get(organizationId)
  if (existing) return existing

  const promise = doRefresh(organizationId).finally(() => {
    inFlightRefreshes.delete(organizationId)
  })
  inFlightRefreshes.set(organizationId, promise)
  return promise
}

async function doRefresh(organizationId: string): Promise<string> {
  // Fast path: a valid token needs no lock at all.
  const current = await prisma.hmrcConnection.findUnique({ where: { organizationId } })
  if (!current) throw new Error('No HMRC connection found for this organisation')
  if (current.expiresAt > new Date(Date.now() + 60_000)) return openToken(current.accessToken)

  return prisma.$transaction(async (tx) => {
    // Serialise refreshes for this organisation across processes. The lock is
    // released automatically when the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`

    // Re-read INSIDE the lock. If another worker refreshed while we waited,
    // this is now a no-op and we return their token.
    const conn = await tx.hmrcConnection.findUnique({ where: { organizationId } })
    if (!conn) throw new Error('No HMRC connection found for this organisation')
    if (conn.expiresAt > new Date(Date.now() + 60_000)) return openToken(conn.accessToken)

    const res = await fetch(`${HMRC_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: openToken(conn.refreshToken),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      // Only a 4xx means the grant is genuinely dead. A 5xx or network blip
      // must NOT downgrade the connection — the previous code marked it ERROR
      // unconditionally, so one transient HMRC outage told the user to
      // reconnect despite holding perfectly valid tokens.
      if (res.status >= 400 && res.status < 500) {
        await tx.hmrcConnection.update({
          where: { organizationId },
          data: { status: 'EXPIRED' },
        })
      }
      // Deliberately does not include the response body: this message can
      // reach the browser via tRPC, and HMRC's OAuth errors are internal detail.
      console.error('[HMRC] token refresh failed', { organizationId, status: res.status, body })
      throw new Error(`HMRC token refresh failed with status ${res.status}`)
    }

    const tokens: HmrcTokenResponse = await res.json()

    // Compare-and-swap: only write if the refresh token is still the one we
    // exchanged, so a slow writer cannot overwrite a newer token.
    const updated = await tx.hmrcConnection.updateMany({
      where: { organizationId, refreshToken: conn.refreshToken },
      data: {
        accessToken: sealToken(tokens.access_token),
        refreshToken: sealToken(tokens.refresh_token),
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        lastRefreshedAt: new Date(),
        status: 'ACTIVE',
      },
    })

    if (updated.count === 0) {
      // Someone else won. Their token is the valid one.
      const latest = await tx.hmrcConnection.findUnique({ where: { organizationId } })
      if (latest) return openToken(latest.accessToken)
    }

    return tokens.access_token
  })
}

export async function storeHmrcConnection(
  organizationId: string,
  tokens: HmrcTokenResponse,
  vrn?: string
): Promise<void> {
  await prisma.hmrcConnection.upsert({
    where: { organizationId },
    create: {
      organizationId,
      accessToken: sealToken(tokens.access_token),
      refreshToken: sealToken(tokens.refresh_token),
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      vatRegistrationNumber: vrn,
      status: 'ACTIVE',
    },
    update: {
      accessToken: sealToken(tokens.access_token),
      refreshToken: sealToken(tokens.refresh_token),
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: 'ACTIVE',
      lastRefreshedAt: new Date(),
      // Reconnecting may bind a DIFFERENT HMRC identity. Prisma treats
      // `undefined` as "leave unchanged", so the previous code silently kept
      // the old VRN paired with new credentials — the connection then looked
      // complete and ACTIVE while filing under a mismatched identity.
      // Clear it and force re-entry via setVatRegistrationNumber.
      vatRegistrationNumber: vrn ?? null,
      businessName: null,
      lastSyncAt: null,
    },
  })
}
