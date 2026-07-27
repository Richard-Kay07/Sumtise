/**
 * HMRC API error taxonomy.
 *
 * HMRC returns { code, message } and sometimes a nested errors[] array.
 * The codes are inconsistent across endpoints — obligations uses
 * INVALID_DATE_FROM while liabilities/payments use DATE_FROM_INVALID for the
 * same condition — so both spellings are handled.
 *
 * Every code carries a user-facing message written for an accountant, not a
 * developer: it says what to do next, not what went wrong internally.
 */

export interface HmrcErrorBody {
  code?: string
  message?: string
  errors?: Array<{ code?: string; message?: string; path?: string }>
  /** HMRC's OAuth endpoints use the RFC 6749 shape instead of code/message. */
  error?: string
  error_description?: string
}

export type HmrcErrorKind =
  | "AUTH"          // reconnect to HMRC
  | "VALIDATION"    // caller sent something invalid — fix and retry
  | "BUSINESS"      // HMRC rejected on business rules — do not retry blindly
  | "NOT_FOUND"
  | "RATE_LIMIT"    // back off and retry
  | "SERVER"        // HMRC-side — retry later
  | "UNKNOWN"

export class HmrcApiError extends Error {
  readonly status: number
  readonly code: string
  readonly kind: HmrcErrorKind
  /** Safe to show to an end user */
  readonly userMessage: string
  /** True if a retry could plausibly succeed without user intervention */
  readonly retryable: boolean
  readonly correlationId?: string
  readonly raw?: HmrcErrorBody

  constructor(args: {
    status: number
    code: string
    kind: HmrcErrorKind
    userMessage: string
    retryable: boolean
    correlationId?: string
    raw?: HmrcErrorBody
    message?: string
  }) {
    super(args.message ?? `HMRC ${args.status} ${args.code}: ${args.userMessage}`)
    this.name = "HmrcApiError"
    this.status = args.status
    this.code = args.code
    this.kind = args.kind
    this.userMessage = args.userMessage
    this.retryable = args.retryable
    this.correlationId = args.correlationId
    this.raw = args.raw
  }
}

interface Mapping {
  kind: HmrcErrorKind
  userMessage: string
  retryable?: boolean
}

const CODE_MAP: Record<string, Mapping> = {
  // ── Validation (400) ───────────────────────────────────────────────────────
  VRN_INVALID: {
    kind: "VALIDATION",
    userMessage:
      "The VAT registration number is not valid. Check it in Tax Settings — it should be 9 digits with no spaces or the GB prefix.",
  },
  PERIOD_KEY_INVALID: {
    kind: "VALIDATION",
    userMessage:
      "HMRC did not recognise this VAT period. Refresh your obligations and select the period again.",
  },
  INVALID_REQUEST: {
    kind: "VALIDATION",
    userMessage: "HMRC rejected the return as invalid. Check every box value and try again.",
  },
  VAT_TOTAL_VALUE: {
    kind: "VALIDATION",
    userMessage:
      "Box 3 must equal Box 1 plus Box 2. Recalculate the return before submitting.",
  },
  VAT_NET_VALUE: {
    kind: "VALIDATION",
    userMessage:
      "Box 5 must be the difference between Box 3 and Box 4. Recalculate the return before submitting.",
  },
  INVALID_NUMERIC_VALUE: {
    kind: "VALIDATION",
    userMessage: "One of the VAT boxes is not a valid number.",
  },
  INVALID_MONETARY_AMOUNT: {
    kind: "VALIDATION",
    userMessage:
      "A VAT box is outside the permitted range. Boxes 1–5 allow 2 decimal places; boxes 6–9 must be whole pounds.",
  },
  CHARGE_REFERENCE_INVALID: {
    kind: "VALIDATION",
    userMessage: "The penalty charge reference is not valid.",
  },
  // Date codes — obligations spelling
  INVALID_DATE_FROM: { kind: "VALIDATION", userMessage: "The 'from' date is not valid." },
  INVALID_DATE_TO: { kind: "VALIDATION", userMessage: "The 'to' date is not valid." },
  INVALID_DATE_RANGE: {
    kind: "VALIDATION",
    userMessage: "The date range is too wide. HMRC allows a maximum of 366 days for obligations.",
  },
  INVALID_STATUS: { kind: "VALIDATION", userMessage: "The obligation status filter is not valid." },
  // Date codes — liabilities/payments spelling (same conditions, different names)
  DATE_FROM_INVALID: { kind: "VALIDATION", userMessage: "The 'from' date is not valid." },
  DATE_TO_INVALID: { kind: "VALIDATION", userMessage: "The 'to' date is not valid." },
  DATE_RANGE_INVALID: {
    kind: "VALIDATION",
    userMessage: "The date range is too wide. HMRC allows a maximum of 365 days here.",
  },

  // ── Auth (401) ─────────────────────────────────────────────────────────────
  MISSING_CREDENTIALS: {
    kind: "AUTH",
    userMessage: "Not connected to HMRC. Connect your HMRC account in Tax Settings.",
  },
  INVALID_CREDENTIALS: {
    kind: "AUTH",
    userMessage: "Your HMRC authorisation has expired. Reconnect your HMRC account.",
  },
  UNAUTHORIZED: {
    kind: "AUTH",
    userMessage: "HMRC rejected the authorisation. Reconnect your HMRC account.",
  },
  INCORRECT_ACCESS_TOKEN_TYPE: {
    kind: "AUTH",
    userMessage: "Wrong credential type used for this HMRC service. This is a configuration fault.",
  },

  // ── Business rules (403) ───────────────────────────────────────────────────
  // NOT "AUTH": the OAuth token is perfectly valid, the client simply is not
  // MTD-enrolled or the agent lacks authorisation for that VRN. Classifying it
  // as AUTH marked a healthy connection as broken and told the user to
  // reconnect, which cannot fix it.
  CLIENT_OR_AGENT_NOT_AUTHORISED: {
    kind: "BUSINESS",
    userMessage:
      "HMRC says this account is not authorised for that VAT number. Check you signed in with the VAT (MTD) business account — or, if you are an agent, your Agent Services Account rather than an older Government Gateway agent ID.",
  },
  RULE_INSOLVENT_TRADER: {
    kind: "BUSINESS",
    userMessage:
      "HMRC has flagged this trader as insolvent. Insolvent traders cannot file through the MTD API — contact HMRC directly.",
  },
  NOT_FINALISED: {
    kind: "BUSINESS",
    userMessage: "The return must be declared final before it can be submitted.",
  },
  DUPLICATE_SUBMISSION: {
    kind: "BUSINESS",
    userMessage:
      "A VAT return has already been submitted for this period. It cannot be submitted twice — corrections go through HMRC's separate amendment process.",
  },
  TAX_PERIOD_NOT_ENDED: {
    kind: "BUSINESS",
    userMessage: "This VAT period has not ended yet, so it cannot be submitted.",
  },
  DATE_RANGE_TOO_LARGE: {
    kind: "BUSINESS",
    userMessage: "HMRC only returns VAT returns filed within the last 4 years.",
  },
  HTTPS_REQUIRED: {
    kind: "VALIDATION",
    userMessage: "The request must use HTTPS. This is a configuration fault.",
  },
  RESOURCE_FORBIDDEN: {
    kind: "AUTH",
    userMessage: "This application is not subscribed to the HMRC VAT API.",
  },
  INVALID_SCOPE: {
    kind: "AUTH",
    userMessage:
      "The HMRC authorisation is missing a required permission. Reconnect your HMRC account.",
  },
  FORBIDDEN: {
    kind: "AUTH",
    userMessage: "HMRC refused access to this VAT number.",
  },

  // ── Not found (404) ────────────────────────────────────────────────────────
  NOT_FOUND: { kind: "NOT_FOUND", userMessage: "HMRC has no record matching that request." },
  MATCHING_RESOURCE_NOT_FOUND: {
    kind: "NOT_FOUND",
    userMessage: "HMRC has no record matching that request.",
  },

  // ── Protocol ───────────────────────────────────────────────────────────────
  METHOD_NOT_ALLOWED: {
    kind: "VALIDATION",
    userMessage: "Unsupported request method. This is a configuration fault.",
  },
  ACCEPT_HEADER_INVALID: {
    kind: "VALIDATION",
    userMessage: "Invalid API version header. This is a configuration fault.",
  },

  // ── OAuth endpoint errors (RFC 6749 shape) ─────────────────────────────────
  INVALID_REQUEST_OAUTH: {
    kind: "VALIDATION",
    userMessage: "The HMRC authorisation request was rejected. This is a configuration fault.",
  },
  INVALID_GRANT: {
    kind: "AUTH",
    userMessage: "Your HMRC authorisation is no longer valid. Reconnect your HMRC account.",
  },
  INVALID_CLIENT: {
    kind: "AUTH",
    userMessage: "HMRC did not recognise this application's credentials. Check HMRC_CLIENT_ID and HMRC_CLIENT_SECRET.",
  },
  UNAUTHORIZED_CLIENT: {
    kind: "AUTH",
    userMessage: "This application is not permitted to use that HMRC grant type.",
  },
  ACCESS_DENIED: {
    kind: "AUTH",
    userMessage: "Access was declined at HMRC. Connect again to grant permission.",
  },

  // ── Throttling / server (429, 5xx) ─────────────────────────────────────────
  MESSAGE_THROTTLED_OUT: {
    kind: "RATE_LIMIT",
    userMessage: "HMRC is rate limiting requests. Waiting a moment and retrying.",
    retryable: true,
  },
  INTERNAL_SERVER_ERROR: {
    kind: "SERVER",
    userMessage: "HMRC's service returned an error. Try again shortly.",
    retryable: true,
  },
  NOT_IMPLEMENTED: {
    kind: "SERVER",
    userMessage: "This HMRC endpoint is not available.",
  },
  SERVER_ERROR: {
    kind: "SERVER",
    userMessage: "HMRC's service is unavailable. Try again shortly.",
    retryable: true,
  },
  SCHEDULED_MAINTENANCE: {
    kind: "SERVER",
    userMessage: "HMRC's service is down for scheduled maintenance. Try again later.",
    retryable: true,
  },
  GATEWAY_TIMEOUT: {
    kind: "SERVER",
    userMessage: "HMRC's service timed out. Try again shortly.",
    retryable: true,
  },
}

/** Default mapping by HTTP status when the code is unrecognised. */
function fallbackForStatus(status: number): Mapping {
  if (status === 401) {
    return { kind: "AUTH", userMessage: "HMRC rejected the authorisation. Reconnect your HMRC account." }
  }
  if (status === 403) {
    return { kind: "BUSINESS", userMessage: "HMRC refused this request." }
  }
  if (status === 404) {
    return { kind: "NOT_FOUND", userMessage: "HMRC has no record matching that request." }
  }
  if (status === 429) {
    return {
      kind: "RATE_LIMIT",
      userMessage: "HMRC is rate limiting requests. Waiting a moment and retrying.",
      retryable: true,
    }
  }
  if (status >= 500) {
    return {
      kind: "SERVER",
      userMessage: "HMRC's service returned an error. Try again shortly.",
      retryable: true,
    }
  }
  if (status >= 400) {
    return { kind: "VALIDATION", userMessage: "HMRC rejected the request as invalid." }
  }
  return { kind: "UNKNOWN", userMessage: "An unexpected error occurred talking to HMRC." }
}

/** Parse an HMRC error response into a typed, user-presentable error. */
export function parseHmrcError(
  status: number,
  bodyText: string,
  correlationId?: string,
): HmrcApiError {
  let body: HmrcErrorBody = {}
  try {
    body = JSON.parse(bodyText) as HmrcErrorBody
  } catch {
    // HMRC occasionally returns HTML (e.g. from an edge proxy) — keep the text.
  }

  // Prefer the first nested error code: it is more specific than the envelope,
  // which is often the generic INVALID_REQUEST. `error` covers the RFC 6749
  // shape returned by /oauth/authorize and /oauth/token, which uses different
  // field names from the REST APIs.
  const code =
    body.errors?.[0]?.code ??
    body.code ??
    (body.error ? body.error.toUpperCase() : undefined) ??
    `HTTP_${status}`
  const mapping = CODE_MAP[code] ?? fallbackForStatus(status)

  return new HmrcApiError({
    status,
    code,
    kind: mapping.kind,
    userMessage: mapping.userMessage,
    retryable: mapping.retryable ?? false,
    correlationId,
    raw: Object.keys(body).length ? body : { message: bodyText.slice(0, 500) },
  })
}

/** True when the connection should be marked as needing re-authorisation. */
export function requiresReconnect(err: unknown): boolean {
  return err instanceof HmrcApiError && err.kind === "AUTH"
}
