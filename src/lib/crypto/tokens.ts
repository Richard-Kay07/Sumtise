/**
 * Envelope encryption for third-party OAuth tokens at rest.
 *
 * HMRC's Terms of Use require vendors to "encrypt all customer data at rest
 * and in transit, **including access tokens**". An HMRC access token carries
 * `write:vat` scope — anyone holding one can file a legally binding VAT return
 * for that business — so a leaked database dump or read-replica credential is
 * an immediate, exploitable compromise rather than a theoretical one.
 *
 * Format: `v1:<iv>:<authTag>:<ciphertext>`, all base64.
 * AES-256-GCM provides confidentiality and integrity; the auth tag detects
 * tampering, so a modified ciphertext fails to decrypt rather than yielding
 * attacker-chosen plaintext.
 *
 * The version prefix allows key rotation and makes plaintext legacy rows
 * detectable, so existing connections keep working and re-encrypt on next write.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const VERSION = "v1"
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // 96 bits, the GCM standard
const KEY_LENGTH = 32 // 256 bits

let cachedKey: Buffer | null = null

function key(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. OAuth tokens cannot be stored securely. " +
        "Generate one with: openssl rand -base64 32",
    )
  }

  const buf = Buffer.from(raw, "base64")
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (got ${buf.length}). ` +
        "Generate one with: openssl rand -base64 32",
    )
  }

  cachedKey = buf
  return buf
}

/** True when a stored value is already encrypted by this module. */
export function isSealed(value: string): boolean {
  return value.startsWith(`${VERSION}:`)
}

/** Encrypt a token for storage. */
export function sealToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

/**
 * Decrypt a stored token.
 *
 * Values without the version prefix are returned unchanged: rows written
 * before encryption was introduced are still readable, and get re-sealed the
 * next time they are written. Those rows must be treated as already exposed
 * and rotated — see docs/hmrc-integration.md.
 */
export function openToken(stored: string): string {
  if (!isSealed(stored)) return stored

  const parts = stored.split(":")
  if (parts.length !== 4) {
    throw new Error("Malformed sealed token: expected v1:<iv>:<tag>:<ciphertext>")
  }

  const [, ivB64, tagB64, ciphertextB64] = parts
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/** True when token encryption is configured. Used to fail fast at boot. */
export function isTokenEncryptionConfigured(): boolean {
  try {
    key()
    return true
  } catch {
    return false
  }
}
