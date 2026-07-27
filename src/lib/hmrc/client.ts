/**
 * Core HMRC API client.
 *
 * Handles: OAuth token refresh, the mandatory Accept version header, fraud
 * prevention headers, HMRC's 3-requests-per-second application rate limit,
 * bounded retry with exponential backoff, and typed error mapping.
 *
 * HMRC platform constraints this implements:
 *  - 3 req/sec per application → 429 MESSAGE_THROTTLED_OUT above that.
 *    HMRC advises against batching: "our rate limits are designed to
 *    encourage real-time interactions".
 *  - No CORS — these calls must be server-side only.
 *  - Accept: application/vnd.hmrc.1.0+json is required on every call.
 */

import { refreshAccessToken } from "./oauth"
import {
  buildFraudPreventionHeaders,
  type FraudPreventionInput,
} from "./fraud-prevention"
import { parseHmrcError, HmrcApiError } from "./errors"
import { prisma } from "@/lib/prisma"

const HMRC_BASE_URL =
  process.env.HMRC_BASE_URL ?? "https://test-api.service.hmrc.gov.uk"

const API_VERSION_ACCEPT = "application/vnd.hmrc.1.0+json"

/** HMRC's documented limit is 3 req/sec per application. Stay just under it. */
const RATE_LIMIT_PER_SECOND = 3
const RATE_WINDOW_MS = 1000

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

// ─── Rate limiter ────────────────────────────────────────────────────────────

/**
 * Simple sliding-window limiter, process-local.
 *
 * NOTE: this bounds a single Node process only. HMRC's limit is per
 * APPLICATION, so horizontal scaling across replicas can still exceed it —
 * a shared limiter (Redis) is required before running more than one instance.
 * Tracked in docs/hmrc-integration.md.
 */
const requestTimestamps: number[] = []

async function acquireRateLimitSlot(): Promise<void> {
  for (;;) {
    const now = Date.now()

    // Drop timestamps that have aged out of the window.
    while (requestTimestamps.length && now - requestTimestamps[0] >= RATE_WINDOW_MS) {
      requestTimestamps.shift()
    }

    if (requestTimestamps.length < RATE_LIMIT_PER_SECOND) {
      requestTimestamps.push(now)
      return
    }

    // Wait until the oldest request leaves the window.
    const waitMs = RATE_WINDOW_MS - (now - requestTimestamps[0]) + 5
    await new Promise((r) => setTimeout(r, waitMs))
  }
}

// ─── Request ─────────────────────────────────────────────────────────────────

export interface HmrcRequestOptions {
  method?: "GET" | "POST"
  body?: unknown
  /** Fraud prevention data — mandatory in production, see fraud-prevention.ts */
  fraudPrevention?: FraudPreventionInput
  /** Sandbox-only stub trigger. MUST NOT be sent in production. */
  govTestScenario?: string
  timeoutMs?: number
  /** Disable retries for non-idempotent calls that must not be duplicated. */
  noRetry?: boolean
}

/**
 * Make an authenticated request to HMRC.
 *
 * Retry policy: only retried on 429 and 5xx, and never when noRetry is set.
 * VAT return submission passes noRetry — a retried POST that actually
 * succeeded the first time produces DUPLICATE_SUBMISSION, and worse, could
 * leave HMRC and our ledger disagreeing about whether a return was filed.
 */
export async function hmrcRequest<T>(
  organizationId: string,
  path: string,
  options: HmrcRequestOptions = {},
): Promise<{ data: T; correlationId?: string; headers: Headers }> {
  const {
    method = "GET",
    body,
    fraudPrevention,
    govTestScenario,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noRetry = false,
  } = options

  const isProduction = HMRC_BASE_URL.includes("//api.service.hmrc.gov.uk")

  if (isProduction && govTestScenario) {
    throw new Error(
      "Gov-Test-Scenario must never be sent to the HMRC production environment.",
    )
  }

  if (isProduction && !fraudPrevention) {
    // Failing loudly is correct: silently omitting these is a legal breach
    // that HMRC punishes out-of-band, so it must never reach production.
    throw new Error(
      "Fraud prevention data is required by law for production HMRC calls but was not supplied.",
    )
  }

  let lastError: HmrcApiError | undefined

  for (let attempt = 0; attempt <= (noRetry ? 0 : MAX_RETRIES); attempt++) {
    await acquireRateLimitSlot()

    const token = await refreshAccessToken(organizationId)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: API_VERSION_ACCEPT,
      ...(fraudPrevention ? buildFraudPreventionHeaders(fraudPrevention) : {}),
    }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (govTestScenario) headers["Gov-Test-Scenario"] = govTestScenario

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let res: Response
    try {
      res = await fetch(`${HMRC_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      // Network failure or timeout. Retry unless this is a no-retry call.
      if (noRetry || attempt === MAX_RETRIES) {
        throw new HmrcApiError({
          status: 0,
          code: "NETWORK_ERROR",
          kind: "SERVER",
          userMessage:
            "Could not reach HMRC. Check your connection and try again shortly.",
          retryable: true,
          message: `HMRC request failed: ${(err as Error).message}`,
        })
      }
      await backoff(attempt)
      continue
    }
    clearTimeout(timer)

    const correlationId = res.headers.get("X-CorrelationId") ?? undefined

    if (res.ok) {
      // 204 and empty bodies are valid for some endpoints.
      const text = await res.text()
      const data = (text ? JSON.parse(text) : {}) as T
      return { data, correlationId, headers: res.headers }
    }

    const errorText = await res.text()
    lastError = parseHmrcError(res.status, errorText, correlationId)

    // Mark the connection so the UI can prompt a reconnect.
    if (lastError.kind === "AUTH") {
      await prisma.hmrcConnection
        .update({
          where: { organizationId },
          data: { status: res.status === 401 ? "EXPIRED" : "ERROR" },
        })
        .catch(() => {
          /* connection row may not exist; the original error is what matters */
        })
    }

    if (!lastError.retryable || noRetry || attempt === MAX_RETRIES) {
      throw lastError
    }

    await backoff(attempt, res.headers.get("Retry-After"))
  }

  throw (
    lastError ??
    new HmrcApiError({
      status: 0,
      code: "UNKNOWN",
      kind: "UNKNOWN",
      userMessage: "An unexpected error occurred talking to HMRC.",
      retryable: false,
    })
  )
}

/**
 * Exponential backoff with jitter. HMRC only says to back off for "a short
 * period of time" after a 429, so honour Retry-After when present.
 */
async function backoff(attempt: number, retryAfter?: string | null): Promise<void> {
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds > 0) {
      await new Promise((r) => setTimeout(r, Math.min(seconds * 1000, 30_000)))
      return
    }
  }
  const base = 500 * 2 ** attempt
  const jitter = Math.floor(Math.random() * 250)
  await new Promise((r) => setTimeout(r, base + jitter))
}

export { HMRC_BASE_URL }
