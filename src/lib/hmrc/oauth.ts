import { prisma } from '@/lib/prisma'

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

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'read:vat write:vat',
    redirect_uri: REDIRECT_URI,
    state,
  })
  return `${HMRC_BASE_URL}/oauth/authorize?${params}`
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

export async function refreshAccessToken(organizationId: string): Promise<string> {
  const conn = await prisma.hmrcConnection.findUnique({ where: { organizationId } })
  if (!conn) throw new Error('No HMRC connection found for this organisation')

  if (conn.expiresAt > new Date(Date.now() + 60_000)) {
    return conn.accessToken
  }

  const res = await fetch(`${HMRC_BASE_URL}/oauth/token`, {
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
    const body = await res.text()
    await prisma.hmrcConnection.update({
      where: { organizationId },
      data: { status: 'ERROR' },
    })
    throw new Error(`HMRC token refresh failed: ${res.status} ${body}`)
  }

  const tokens: HmrcTokenResponse = await res.json()
  await prisma.hmrcConnection.update({
    where: { organizationId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastRefreshedAt: new Date(),
      status: 'ACTIVE',
    },
  })

  return tokens.access_token
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
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      vatRegistrationNumber: vrn,
      status: 'ACTIVE',
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      vatRegistrationNumber: vrn ?? undefined,
      status: 'ACTIVE',
      lastRefreshedAt: new Date(),
    },
  })
}
