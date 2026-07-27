# HMRC Integration — Status, Setup and Constraints

Last updated: 2026-07-27

## Scope reality: what HMRC actually offers

The four things commonly requested sit on **two completely different
integration channels**. This is the single most important fact for planning.

| Requirement | HMRC channel | Status |
|---|---|---|
| **VAT returns (MTD)** | `vat-api/1.0` — **REST**, OAuth 2.0, JSON | ✅ Implemented (see below) |
| **Corporation tax (CT600)** | GovTalk **XML** via Transaction Engine | ❌ Not started — multi-month programme |
| **Payroll deductions (RTI)** | GovTalk **XML** via Transaction Engine | ❌ Not started — multi-month programme |
| **Statutory accounts** | *No standalone HMRC API exists* | ❌ See note below |

**Statutory accounts** do not have an HMRC filing API. They go:
1. to **Companies House**, via its own separate XML Gateway / REST products; and
2. to **HMRC** only as **iXBRL attachments inside the CT600**.

HMRC's free joint-filing service (CATO) closed on 31 March 2026, so these are
now two independent integrations.

### Why CT600 and RTI are not "just another API"

Both are on the legacy Government Gateway channel, which differs from MTD in
every respect:

- **Transport**: GovTalk XML POSTed to `transaction-engine.tax.service.gov.uk`,
  with an asynchronous 5-step poll state machine
  (`SUBMISSION_REQUEST` → `ACKNOWLEDGEMENT` → poll → `RESPONSE` → `DELETE_REQUEST`).
  Not a synchronous request/response.
- **Auth**: no OAuth. Government Gateway credentials are placed **in clear text
  inside the XML envelope** (`<Authentication><Method>clear</Method>`). You must
  store your customers' Gateway passwords — a significant liability difference.
- **IRmark**: a mandatory cryptographic proof-of-filing (inclusive XML
  canonicalisation per `REC-xml-c14n-20010315`, SHA-1, Base64). Whitespace,
  namespace or comment differences silently break it.
- **Onboarding**: no self-service. You email `SDSTeam@hmrc.gov.uk` to be issued
  a 4-digit **Vendor ID**, then pass a recognition process where HMRC humans
  sign off your test submissions. CT recognition renews **annually**.
- **CT600 additionally requires an iXBRL engine** for accounts and computations
  across FRS 101/102/105, IFRS, DPL and the CT Computations taxonomy. This is a
  product in its own right, not a feature.
- **RTI requires a correct payroll calculation engine** and a **new HMRC
  technical specification every tax year**, with a hard April deadline.

Rough effort ratio, if VAT MTD is 1 unit: **RTI ≈ 5–10×**, **CT600 + iXBRL ≈ 15–30×**.

---

## What is implemented (VAT MTD)

| File | Purpose |
|---|---|
| `src/lib/hmrc/oauth.ts` | Authorisation URL, code exchange, token refresh |
| `src/lib/hmrc/state.ts` | HMAC-signed, time-limited OAuth `state` bound to (org, user) |
| `src/lib/hmrc/fraud-prevention.ts` | The 16 legally-required headers, server half |
| `src/lib/hmrc/fingerprint-client.ts` | Browser half — the 5 device-only values |
| `src/lib/hmrc/client.ts` | Auth, rate limiting, retry, timeout, error mapping |
| `src/lib/hmrc/errors.ts` | HMRC error taxonomy with user-facing messages |
| `src/lib/hmrc/vat.ts` | All 8 VAT API endpoints, Zod-validated |
| `src/app/api/hmrc/callback/route.ts` | OAuth callback with state + membership verification |

All 8 VAT endpoints are covered: obligations, submit return, view return,
liabilities, payments, penalties, financial details, customer information.

---

## Required environment variables

```dotenv
# From the HMRC Developer Hub application → manage credentials
HMRC_CLIENT_ID=""
HMRC_CLIENT_SECRET=""

# Sandbox: https://test-api.service.hmrc.gov.uk
# Production: https://api.service.hmrc.gov.uk
HMRC_BASE_URL="https://test-api.service.hmrc.gov.uk"

# Must EXACTLY match a redirect URI registered on the Developer Hub app
HMRC_REDIRECT_URI="https://sumtise-production.up.railway.app/api/hmrc/callback"

# Optional — defaults to "read:vat write:vat"
HMRC_SCOPE="read:vat write:vat"

# REQUIRED. Signs the OAuth state parameter. No fallback — must be >= 32 chars
# and must not be a placeholder. Generate: openssl rand -base64 32
HMRC_STATE_SECRET=""

# REQUIRED for fraud prevention: the public IP that end users' browsers
# connect to (our WAF / load balancer / edge). See the open item below.
HMRC_VENDOR_PUBLIC_IP=""

# REQUIRED. AES-256-GCM key encrypting OAuth tokens at rest, per HMRC's terms
# of use. Generate: openssl rand -base64 32
TOKEN_ENCRYPTION_KEY=""
```

Note the **authorize** endpoint is on a different host from the API and is
derived automatically (`test-www.tax.service.gov.uk` in sandbox,
`www.tax.service.gov.uk` in production). Override with `HMRC_AUTHORIZE_URL`
only if HMRC changes it.

---

## Setup checklist — steps only a human can do

Technical work is done; these require a real identity and legal acceptance.

### Phase 1 — Sandbox (self-service, same day)

1. Register: <https://developer.service.hmrc.gov.uk/developer/registration>
2. Add a sandbox application:
   <https://developer.service.hmrc.gov.uk/developer/applications/add/sandbox>
3. Subscribe it to: **VAT (MTD)**, **Create Test User**, and
   **Test Fraud Prevention Headers**
4. Generate `client_id` / `client_secret` on the manage-credentials page
5. Register the redirect URI (max 5 per app; HTTPS required, `http://localhost:PORT` allowed)

⚠️ A sandbox app is **auto-deleted if no API call is made within 30 days**.

### Phase 2 — Production (requires HMRC review, ~4–8 weeks)

Two independent gates, both mandatory:

**Gate A — VAT MTD approval (SDST).** Minimum functionality HMRC requires:
fraud prevention headers, retrieve obligations, submit return. Complete the
sandbox test sequence, then email `SDSTeam@hmrc.gov.uk` **within 2 weeks** of
finishing (they read your actual sandbox logs — do not send your own logs).
Two questionnaires follow. **10 working days** for an outcome.

**Gate B — Developer Hub production credentials.** A form behind login. Needs:
- a nominated **responsible individual** (a named real person)
- **evidence the organisation is registered** — UTR, VAT number, PAYE ref, or
  Companies House number
- a product-specific **privacy policy URL** and **terms & conditions URL**
- disclosure of **where servers processing customer data are located**
- **up to 10 working days** to review; you have 6 months to complete the request

Application naming: must match the organisation name, must **not** reference HMRC.
Only **one** production application is needed — customer isolation is via OAuth.

### Phase 3 — Optional listing

To appear on gov.uk's compatible-software list you must make one **real live
submission and give HMRC the VRN**. Accessibility listing requires **WCAG 2 AA**
evidence. You may say "HMRC recognised" only after formal recognition — never
"approved", "accredited" or "certified".

---

## Open items before production

These are known gaps. Each must be closed before Gate A.

### 1. `Gov-Client-Public-Port` may be unobtainable — HIGHEST RISK

HMRC mandates the end user's **ephemeral TCP source port**. Railway's proxy
sets `X-Forwarded-For` but is not known to expose the client source port.
`extractClientNetwork()` returns `undefined` when it cannot find a valid one,
and the header is then omitted rather than filled with a placeholder.

HMRC's own warning: *"some popular load balancers do not pass on users' public
IPs or ports… If you find out later that your chosen technology stack does not
support sending all required values, it may involve effort to change."*

**Action:** verify empirically against Railway before Gate A. If unobtainable,
either front the app with an edge that exposes it (Cloudflare provides
`cf-connecting-port`) or email `SDSTeam@hmrc.gov.uk` to agree the omission.

### 2. `HMRC_VENDOR_PUBLIC_IP` must be set to a real, stable IP

`Gov-Vendor-Public-IP` and the first hop of `Gov-Vendor-Forwarded` both use it,
and HMRC **cross-validates them against `Gov-Client-Public-IP`**. If egress IPs
rotate, this needs a static-egress path.

### 3. `Gov-Vendor-License-IDs` is deliberately omitted

Sumtise is subscription SaaS with no per-device licence key, so there is no
value to collect. HMRC's process requires **emailing `SDSTeam@hmrc.gov.uk`
first** and agreeing the omission. Sending an empty string or placeholder would
itself be non-compliant.

### 4. Tokens are stored in plaintext

`HmrcConnection.accessToken` / `.refreshToken` are `@db.Text` with no
encryption. HMRC's terms of use require *"encrypt all customer data at rest and
in transit, **including access tokens**"*. **This will fail Gate B.** Needs
application-level encryption before production.

### 5. Rate limiter is process-local

HMRC's 3 req/sec limit is **per application**, but the limiter in `client.ts`
bounds a single Node process. Running more than one replica can exceed the
limit. Needs a shared (Redis) limiter before horizontal scaling.

### 6. Penetration test required

HMRC's terms require SaaS to have **passed penetration testing** before going
live.

### 7. Migrations vs `db push`

`hmrc_connections` and `vat_periods` exist in `schema.prisma` but have **no
migration file**. Railway uses `prisma db push`, so production has the tables;
any environment using `prisma migrate` will not. Generate the migration before
adopting a migration-based workflow.

---

## Testing without production credentials

The **Create Test User API** provisions a sandbox organisation with a real test
VRN, using application-restricted `client_credentials` (no end user needed):

```bash
# 1. Get an application token
curl -X POST https://test-api.service.hmrc.gov.uk/oauth/token \
  -H "content-type: application/x-www-form-urlencoded" \
  -d "client_secret=$HMRC_CLIENT_SECRET&client_id=$HMRC_CLIENT_ID&grant_type=client_credentials"

# 2. Create a test organisation enrolled for MTD VAT
curl -X POST https://test-api.service.hmrc.gov.uk/create-test-user/organisations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/vnd.hmrc.1.0+json" \
  -d '{"serviceNames":["mtd-vat"]}'
```

The response contains `userId`, `password` and **`vrn`**. Sign in with those
during the OAuth journey; use the VRN in API calls.

Sandbox stubs are driven by the `Gov-Test-Scenario` header — e.g.
`QUARTERLY_ONE_MET` on obligations, `DUPLICATE_SUBMISSION` on submit.
`hmrcRequest()` **throws if this header is ever used against production**.

Validate fraud prevention headers with the validator API:
`GET https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate`
then, after sandbox runs,
`GET .../fraud-prevention-headers/vat-mtd/validation-feedback?connectionMethod=WEB_APP_VIA_SERVER`

---

## Platform constraints worth remembering

- **3 requests/second per application** → `429 MESSAGE_THROTTLED_OUT`.
  HMRC advises *against* batching.
- **No CORS** — the API cannot be called from browser JS. Server-side only.
- **Access token lasts 4 hours**; refresh tokens are **single-use**; overall
  authority expires after **18 months**, requiring full re-authorisation.
- **Insolvent traders are not supported** (`RULE_INSOLVENT_TRADER`, 403).
- **No amend endpoint** — a filed return cannot be corrected via the API.
- Do not pin HMRC TLS certificates or firewall by IP (HMRC has no static IPs).

## For accountant customers (not us)

Agents must use an **Agent Services Account**, not an old Government Gateway
agent ID — this is the most common support failure. Getting an ASA requires the
firm's UTR and **proof of anti-money-laundering supervision**. The AML
obligation is on the accountancy firm, not on Sumtise.

---

## Review findings addressed (2026-07-27)

Three independent zero-context review agents audited this integration. Fixed:

**Security**
- OAuth `state` was the raw org ID → now HMAC-signed, TTL'd, bound to (org, user)
- Callback verified membership but not `SETTINGS_EDIT` → permission now re-checked
- `HMRC_STATE_SECRET` fell back to `NEXTAUTH_SECRET`, which env templates ship as
  the literal `"your-secret-key-here"` → fallback removed, placeholders rejected
- Tokens stored in plaintext → AES-256-GCM at rest (`src/lib/crypto/tokens.ts`)
- Refresh was a read-modify-write race; HMRC refresh tokens are single-use, so
  concurrent refreshes could persist a revoked token and permanently brick the
  connection → advisory lock + compare-and-swap + in-process coalescing
- Transient HMRC 5xx unconditionally marked the connection `ERROR` → only 4xx now
- Reconnecting kept the OLD VRN paired with NEW credentials → VRN cleared on
  token replacement
- Raw HMRC token-endpoint bodies reached the browser → generic message, detail logged

**Fraud prevention headers**
- `"unknown"` and empty-string placeholders could be emitted → now fails closed
- `X-Forwarded-For` left-most entry is client-controlled → prefers platform
  headers, falls back to right-most; `??` → `||` so empty headers fall through
- `navigator.userAgent` passed through unsanitised (CRLF injection) → sanitised
- Client-supplied fingerprint unvalidated → UUID / `UTC±hh:mm` / positive ints

**Accounting correctness**
- `getVATQuarter` was off by one month — a March date returned a period ending
  28 Feb, *before the date itself* → fixed, and moved to UTC
- `OUT_OF_SCOPE` mapped to a truthy rate code, so wages and PAYE landed in
  Box 7 → now excluded per VAT Notice 700/12
- Input VAT on capital items was dropped because purchases post to ASSET
  accounts → ASSET debits now included
- Period boundaries used local-time midnight with `lte`, so under BST a 30 June
  posting moved into the next quarter → half-open UTC interval
- Double-submission guard required `status === "FULFILLED"`, which
  `syncObligations` overwrites → now keyed on the receipt alone
- Receipt persisted with `updateMany`, silently matching zero rows when
  obligations had never synced → upsert, and stored *before* response validation
- `CLIENT_OR_AGENT_NOT_AUTHORISED` (403) marked the connection broken though the
  token is valid → reclassified as a business error
- POST timeouts reported as safely retryable → now flagged indeterminate

### Deliberately blocked rather than silently wrong

`getVATReturn` now **rejects** `cash` and `flat_rate`. Cash accounting was
computing on the invoice basis (declaring VAT on unpaid invoices); FRS had Box 6
on a net rather than gross basis, never reclaimed capital-goods input VAT, and
filed a **nil return** when the flat-rate percentage was omitted. Refusing is the
only safe behaviour — the alternative is a wrong number on a filed return.

### Known gaps — NOT production-ready for general use

- **Boxes 1 and 4 are imputed** from the account's VAT treatment
  (`net × rate`) rather than read from VAT actually charged. Mixed-rate
  invoices, supplier rounding, fuel scale charges and bad-debt relief will not
  reconcile. Box 1 should come from the VAT control account.
- **Reverse charge (CIS), Postponed VAT Accounting, partial exemption and
  blocked input tax are not modelled.** `VatTreatment` has no values for them.
- **Boxes 2, 8 and 9 are hardcoded to 0** — wrong for Northern Ireland traders
  under the NI Protocol.
- **`exchangeRate` is ignored** — a USD invoice enters Box 6 at face value.
- **`submitMtdVatReturn` has no UI caller yet.** `/tax/vat-mtd` still calls
  `createVATSubmission`, which only writes a local row. Filing is reachable via
  the API but not yet from the page.
