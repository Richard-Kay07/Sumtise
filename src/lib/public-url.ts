/**
 * Resolve the application's PUBLIC base URL for building redirects.
 *
 * Do not use `req.url` for this. Inside the Next.js standalone server the
 * request URL reflects the internal bind address, which on Railway is
 * `http://0.0.0.0:8080`. `new URL('/tax/settings', req.url)` therefore produced
 * `http://0.0.0.0:8080/tax/settings`, and redirecting a browser there fails
 * with ERR_CONNECTION_REFUSED — the user's machine has nothing on 0.0.0.0.
 *
 * That broke the HMRC OAuth return journey: the user completed consent at HMRC,
 * came back to our callback, and was then sent to an unreachable address.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_APP_URL    — explicit and authoritative
 *  2. x-forwarded-proto/host  — set by the edge, reflects what the browser used
 *  3. host header             — last resort
 */

const INTERNAL_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "::1", "[::1]"])

function isInternal(host: string): boolean {
  const bare = host.split(":")[0]
  return INTERNAL_HOSTS.has(bare) || INTERNAL_HOSTS.has(host)
}

/** Public origin, with no trailing slash. */
export function getPublicBaseUrl(headers?: Headers): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "")
  if (configured) {
    try {
      if (!isInternal(new URL(configured).host)) return configured
    } catch {
      // Malformed env value — fall through to the header-derived value.
    }
  }

  if (headers) {
    const fwdHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    const host = fwdHost || headers.get("host")?.trim()
    if (host && !isInternal(host)) {
      const proto =
        headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (host.startsWith("localhost") ? "http" : "https")
      return `${proto}://${host}`
    }
  }

  // Railway always sets this; useful when no request is in scope.
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  if (railway) return `https://${railway}`

  return "http://localhost:3000"
}

/**
 * Build an absolute URL to an in-app path, safe to hand to a browser.
 * Always pass the inbound request headers when a request is in scope.
 */
export function publicUrl(path: string, headers?: Headers): URL {
  const base = getPublicBaseUrl(headers)
  return new URL(path.startsWith("/") ? path.slice(1) : path, base + "/")
}
