/**
 * HMRC Fraud Prevention Headers — spec v3.3 (27 January 2025)
 * Connection method: WEB_APP_VIA_SERVER
 *
 * https://developer.service.hmrc.gov.uk/guides/fraud-prevention/
 *
 * These headers are REQUIRED BY LAW on every call to an MTD API
 * (Delivery of Tax Information through Software (Ancillary Metadata)
 * Regulations 2019, SI 2019/360). HMRC monitors them out-of-band and
 * operates a four-step sanctions ladder up to removal from the API
 * platform. They are NOT validated at request time — a malformed header
 * returns 200, then arrives as a letter to the company secretary.
 *
 * Architecture note: for WEB_APP_VIA_SERVER the "originating device" is
 * the END USER'S BROWSER, not our server. Five values can only be
 * collected client-side and must be captured on the inbound user request,
 * persisted alongside any pending submission, and replayed on the
 * outbound HMRC call. You cannot synthesise them in a background job.
 */

// ─── Percent-encoding (RFC 3986 §2.1) ────────────────────────────────────────

/**
 * HMRC: "Header data contents must be submitted using the US-ASCII character
 * set, with other characters percent encoded."
 *
 * encodeURIComponent leaves !'()* unescaped; RFC 3986 treats them as
 * sub-delims/reserved, so we encode them too for strictness.
 */
function pct(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

/**
 * Key-value structure: `<k1>=<v1>&<k2>=<v2>`
 * Keys and values percent-encoded; `=` and `&` separators are NOT.
 * HMRC: "Whenever a key is applicable but has no applicable value, you can
 * omit the key-value pair or include the key with an empty value."
 */
function kv(pairs: Record<string, string | number | undefined | null>): string {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${pct(k)}=${pct(String(v))}`)
    .join('&')
}

/**
 * List structure: `<v1>,<v2>`
 * Values percent-encoded; the comma separator is NOT. Values must not be empty.
 */
function list(values: string[]): string {
  return values.filter((v) => v !== '').join(',')
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Values only the browser can supply. Collected client-side, sent to our server. */
export interface BrowserFingerprint {
  /** navigator.userAgent — NOT the HTTP User-Agent header */
  jsUserAgent: string
  /** Stable per-device UUID, persisted in a long-lived cookie. Never expires. */
  deviceId: string
  /** UTC±hh:mm — note getTimezoneOffset() sign is inverted */
  timezone: string
  screens: Array<{
    width: number
    height: number
    scalingFactor: number
    colourDepth: number
  }>
  windowSize: { width: number; height: number }
}

/** Values our server derives from the inbound request and its own config. */
export interface ServerContext {
  /** Public IP of the END USER, captured at our edge */
  clientPublicIp: string
  /** ISO8601 with milliseconds, captured at the SAME MOMENT as clientPublicIp */
  clientPublicIpTimestamp: string
  /** End user's ephemeral TCP source port (1–65535). NOT 80/443. */
  clientPublicPort?: string
  /** Public IP of our server/WAF/LB that the browser connected to */
  vendorPublicIp: string
  /** Our internal user identifier */
  userId: string
  /** MFA events for this user's session, if any */
  multiFactor?: Array<{
    type: 'TOTP' | 'AUTH_CODE' | 'OTHER'
    /** yyyy-MM-ddThh:mmZ minimum */
    timestamp: string
    /** Salted+hashed reference — NEVER the secret itself */
    uniqueReference: string
  }>
  /** Additional TLS-terminating internet hops we control, in order */
  extraHops?: Array<{ by: string; for: string }>
}

export interface FraudPreventionInput {
  browser: BrowserFingerprint
  server: ServerContext
}

// ─── Product constants ───────────────────────────────────────────────────────

const PRODUCT_NAME = 'Sumtise'
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'

// ─── Header builder ──────────────────────────────────────────────────────────

/**
 * Build the 16 mandatory headers for WEB_APP_VIA_SERVER.
 *
 * Deliberately omitted (HMRC change log removed them for this connection
 * method): Gov-Client-Local-IPs (+Timestamp) and Gov-Client-Browser-Plugins
 * in v3.1; Gov-Client-Browser-Do-Not-Track in v3.2. Gov-Client-MAC-Addresses
 * and the key-value form of Gov-Client-User-Agent are not in the web-app list
 * at all — a browser cannot supply them.
 *
 * IMPORTANT: never emit a placeholder. HMRC explicitly forbids "null",
 * "undefined", "" as a literal, "unknown" or "0.0.0.0". If a value genuinely
 * cannot be collected you must email SDSTeam@hmrc.gov.uk FIRST and only then
 * omit the header or send it empty.
 */
export function buildFraudPreventionHeaders(
  input: FraudPreventionInput,
): Record<string, string> {
  const { browser, server } = input

  const headers: Record<string, string> = {}

  // 1 — fixed literal
  headers['Gov-Client-Connection-Method'] = 'WEB_APP_VIA_SERVER'

  // 2 — navigator.userAgent, sent verbatim (ASCII in practice)
  if (browser.jsUserAgent) {
    headers['Gov-Client-Browser-JS-User-Agent'] = browser.jsUserAgent
  }

  // 3 — stable device UUID
  if (browser.deviceId) {
    headers['Gov-Client-Device-ID'] = browser.deviceId
  }

  // 4 — MFA list; each element is a kv structure, joined by commas.
  //     Colons inside the timestamp ARE encoded (they sit inside a value).
  if (server.multiFactor?.length) {
    headers['Gov-Client-Multi-Factor'] = list(
      server.multiFactor.map((f) =>
        kv({
          type: f.type,
          timestamp: f.timestamp,
          'unique-reference': f.uniqueReference,
        }),
      ),
    )
  }

  // 5 — end user's public IP (bare value, not encoded)
  headers['Gov-Client-Public-IP'] = server.clientPublicIp

  // 6 — captured at the same instant as #5; must include ms and trailing zeros
  headers['Gov-Client-Public-IP-Timestamp'] = server.clientPublicIpTimestamp

  // 7 — end user's ephemeral source port
  if (server.clientPublicPort) {
    headers['Gov-Client-Public-Port'] = server.clientPublicPort
  }

  // 8 — one kv structure per screen; all four sub-fields required
  if (browser.screens?.length) {
    headers['Gov-Client-Screens'] = list(
      browser.screens.map((s) =>
        kv({
          width: s.width,
          height: s.height,
          'scaling-factor': s.scalingFactor,
          'colour-depth': s.colourDepth,
        }),
      ),
    )
  }

  // 9 — UTC±hh:mm, never an IANA name
  if (browser.timezone) {
    headers['Gov-Client-Timezone'] = browser.timezone
  }

  // 10 — our product name as the key. Never send an `os=` key: the validator
  //      raises an advisory because browsers don't expose it.
  headers['Gov-Client-User-IDs'] = kv({ sumtise: server.userId })

  // 11 — viewport, not screen
  if (browser.windowSize) {
    headers['Gov-Client-Window-Size'] = kv({
      width: browser.windowSize.width,
      height: browser.windowSize.height,
    })
  }

  // 12 — internet hops that terminate TLS. First hop: by = our public IP,
  //      for = client public IP. HMRC cross-validates this against #5 and #15.
  //      Private-network hops must NOT be included.
  const hops = [
    { by: server.vendorPublicIp, for: server.clientPublicIp },
    ...(server.extraHops ?? []),
  ]
  headers['Gov-Vendor-Forwarded'] = list(
    hops.map((h) => kv({ by: h.by, for: h.for })),
  )

  // 13 — Gov-Vendor-License-IDs deliberately NOT emitted.
  //      Sumtise is subscription SaaS with no per-device licence key, so there
  //      is no value to collect. HMRC's process REQUIRES emailing
  //      SDSTeam@hmrc.gov.uk to agree the omission before going live —
  //      sending an empty string or placeholder would itself be non-compliant.
  //      See docs/hmrc-integration.md.

  // 14 — marketed product name
  headers['Gov-Vendor-Product-Name'] = pct(PRODUCT_NAME)

  // 15 — our public-facing IP
  headers['Gov-Vendor-Public-IP'] = server.vendorPublicIp

  // 16 — client-server architecture: send a version for both halves,
  //      which clears the validator's advisory.
  headers['Gov-Vendor-Version'] = kv({
    'sumtise-web': APP_VERSION,
    'sumtise-server': APP_VERSION,
  })

  return headers
}

// ─── Server-side request helpers ─────────────────────────────────────────────

/**
 * Extract the end user's public IP and source port from an inbound request.
 *
 * HMRC warns that "some popular load balancers do not pass on users' public
 * IPs or ports" and refuses to advise on specific stacks. Railway sits behind
 * a proxy that sets X-Forwarded-For but does NOT expose the client's ephemeral
 * source port, so clientPublicPort is frequently undefined — see
 * docs/hmrc-integration.md for the open item.
 */
export function extractClientNetwork(headers: Headers): {
  clientPublicIp: string
  clientPublicIpTimestamp: string
  clientPublicPort?: string
} {
  // Left-most XFF entry is the original client; the rest are proxies.
  const xff = headers.get('x-forwarded-for')
  const clientPublicIp =
    xff?.split(',')[0]?.trim() ??
    headers.get('x-real-ip')?.trim() ??
    headers.get('cf-connecting-ip')?.trim() ??
    ''

  // Cloudflare exposes the source port; most other edges do not.
  const port =
    headers.get('cf-connecting-port')?.trim() ??
    headers.get('x-forwarded-port')?.trim() ??
    undefined

  // Reject server ports — HMRC explicitly forbids 80/443 here, and a
  // proxy-reported x-forwarded-port is usually the listener, not the client.
  const validPort =
    port && port !== '80' && port !== '443' && Number(port) >= 1 && Number(port) <= 65535
      ? port
      : undefined

  return {
    clientPublicIp,
    // Captured now, at the moment we read the IP — not when we later call HMRC.
    clientPublicIpTimestamp: new Date().toISOString(),
    clientPublicPort: validPort,
  }
}

/** Convert a JS timezone offset (minutes behind UTC) to HMRC's UTC±hh:mm. */
export function formatTimezoneOffset(offsetMinutes: number): string {
  // getTimezoneOffset() returns minutes BEHIND UTC, so the sign is inverted:
  // BST (UTC+1) reports -60.
  const inverted = -offsetMinutes
  const sign = inverted >= 0 ? '+' : '-'
  const abs = Math.abs(inverted)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

/** Exported for unit tests. */
export const __testing = { pct, kv, list }
