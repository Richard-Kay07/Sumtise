/**
 * Signed OAuth `state` for the HMRC authorisation flow.
 *
 * The previous implementation used the raw organizationId as `state` and
 * trusted it verbatim in the callback. That allowed any authenticated user to
 * craft a callback binding HMRC tokens to an arbitrary organisation — a
 * cross-tenant vulnerability, and no CSRF protection at all.
 *
 * This binds the state to (organizationId, userId), signs it with HMAC-SHA256,
 * and expires it, so the callback can verify that the person completing the
 * flow is the same person who started it, for the org they actually selected.
 */

import { createHmac, timingSafeEqual, randomBytes } from "crypto"

/** State is only valid briefly — the user is redirected straight to HMRC. */
const STATE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function secret(): string {
  const s =
    process.env.HMRC_STATE_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.CLERK_SECRET_KEY

  if (!s) {
    throw new Error(
      "HMRC_STATE_SECRET (or NEXTAUTH_SECRET / CLERK_SECRET_KEY) must be set to sign the OAuth state.",
    )
  }
  return s
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest())
}

interface StatePayload {
  organizationId: string
  userId: string
  /** Issued-at, epoch ms */
  iat: number
  /** Random nonce so two flows never produce an identical state */
  n: string
}

/** Create a signed state token to send to HMRC. */
export function createOAuthState(organizationId: string, userId: string): string {
  const payload: StatePayload = {
    organizationId,
    userId,
    iat: Date.now(),
    n: randomBytes(9).toString("hex"),
  }
  const encoded = b64url(Buffer.from(JSON.stringify(payload), "utf8"))
  return `${encoded}.${sign(encoded)}`
}

export type StateVerification =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" }

/**
 * Verify a state token returned by HMRC.
 * The caller must ALSO check that the returned userId matches the currently
 * authenticated user, and that the user is a member of the organisation.
 */
export function verifyOAuthState(state: string): StateVerification {
  const parts = state.split(".")
  if (parts.length !== 2) return { ok: false, reason: "malformed" }

  const [encoded, signature] = parts

  const expected = sign(encoded)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  // Length check first: timingSafeEqual throws on mismatched lengths.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" }
  }

  let payload: StatePayload
  try {
    payload = JSON.parse(fromB64url(encoded).toString("utf8")) as StatePayload
  } catch {
    return { ok: false, reason: "malformed" }
  }

  if (
    typeof payload.organizationId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.iat !== "number"
  ) {
    return { ok: false, reason: "malformed" }
  }

  if (Date.now() - payload.iat > STATE_TTL_MS) {
    return { ok: false, reason: "expired" }
  }

  return { ok: true, organizationId: payload.organizationId, userId: payload.userId }
}
