# Environment Variables — Complete Inventory
Generated: 2026-05-26

---

## Currently Present (inferred from source code + env.example)

These variables are already referenced in the codebase and presumably set in the Railway environment.

| Variable | Purpose | Where referenced |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `src/lib/prisma.ts`, Prisma schema |
| `CLERK_SECRET_KEY` | Clerk server-side auth | `src/lib/trpc.ts` (verifyToken) |
| `NEXT_PUBLIC_APP_URL` | Public app URL for links | Dockerfile ARG, email templates |
| `OPENAI_API_KEY` | OpenAI API (current AI provider) | `src/lib/ai/ai-service.ts`, `src/lib/ai/accountant-agent.ts` |
| `FILE_STORAGE_PROVIDER` | `local` / `s3` / `gcs` | `src/lib/storage/index.ts` |
| `FILE_STORAGE_PATH` | Local storage path | `src/lib/storage/drivers/local.ts` |
| `FILE_MAX_SIZE` | Max upload size in bytes | `src/lib/storage/index.ts` |
| `FILE_ALLOWED_MIME_TYPES` | Comma-separated MIME types | `src/lib/storage/index.ts` |
| `FILE_ENABLE_VIRUS_SCAN` | `true`/`false` | `src/lib/storage/index.ts` |
| `EMAIL_PROVIDER` | `sandbox` / `sendgrid` / `ses` / `mailgun` / `smtp` | `src/lib/email/client.ts` |
| `EMAIL_FROM_ADDRESS` | Sender address | `src/lib/email/client.ts` |
| `EMAIL_FROM_NAME` | Sender name | `src/lib/email/client.ts` |
| `EMAIL_REPLY_TO` | Reply-to address | `src/lib/email/client.ts` |
| `EMAIL_DOMAIN` | Domain for Mailgun | `src/lib/email/drivers/mailgun.ts` |
| `EMAIL_SANDBOX_MODE` | `true` in non-prod | `src/lib/email/client.ts` |
| `SENDGRID_API_KEY` | SendGrid auth | `src/lib/email/drivers/sendgrid.ts` |
| `MAILGUN_API_KEY` | Mailgun auth | `src/lib/email/drivers/mailgun.ts` |
| `MAILGUN_DOMAIN` | Mailgun domain | `src/lib/email/drivers/mailgun.ts` |
| `SMTP_HOST` | SMTP server | `src/lib/email/drivers/smtp.ts` |
| `SMTP_PORT` | SMTP port | `src/lib/email/drivers/smtp.ts` |
| `SMTP_SECURE` | `true`/`false` | `src/lib/email/drivers/smtp.ts` |
| `SMTP_USER` | SMTP username | `src/lib/email/drivers/smtp.ts` |
| `SMTP_PASSWORD` | SMTP password | `src/lib/email/drivers/smtp.ts` |
| `AWS_REGION` | AWS region for S3/SES | `src/lib/storage/drivers/s3.ts` |
| `AWS_S3_BUCKET` | S3 bucket name | `src/lib/storage/drivers/s3.ts` |
| `AWS_ACCESS_KEY_ID` | AWS credentials | `src/lib/storage/drivers/s3.ts` |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | `src/lib/storage/drivers/s3.ts` |
| `AWS_SES_REGION` | SES region (may differ from S3) | `src/lib/email/drivers/ses.ts` |
| `GCS_PROJECT_ID` | Google Cloud project | `src/lib/storage/drivers/gcs.ts` |
| `GCS_BUCKET` | GCS bucket name | `src/lib/storage/drivers/gcs.ts` |
| `GCS_KEY_FILENAME` | Service account key file path | `src/lib/storage/drivers/gcs.ts` |
| `GOOGLE_CLIENT_ID` | Google OAuth (NextAuth — see note) | `src/lib/auth.ts` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (NextAuth — see note) | `src/lib/auth.ts` |
| `REDIS_URL` | Referenced but currently unused | `process.env.REDIS_URL` in env scan |
| `REMINDER_JOB_TOKEN` | Auth token for reminder cron endpoint | `src/app/api/jobs/reminders/route.ts` |
| `WORKFLOW_CHASE_SECRET` | Auth token for workflow chase endpoint | `src/app/api/workflow/chase/route.ts` |
| `NODE_ENV` | Runtime environment | Throughout |

**Note on `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`:** These are used by the legacy NextAuth Google provider (`src/lib/auth.ts`). Since Clerk is the active identity provider, these can be removed once the NextAuth remnants are cleaned up (see IMPL-7 / audit-report.md Domain 2).

**Note on `REDIS_URL`:** Referenced in env scans but no Redis client is instantiated anywhere in the codebase. This is dead configuration — either remove it or it was intended for a future queue. IMPL-2 uses pg-boss (PostgreSQL-native) so `REDIS_URL` remains unused.

---

## Missing for Phase 1

Add all of these before deploying Phase 1 features.

### Anthropic (IMPL-3)

| Variable | Value/Format | How to obtain |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | console.anthropic.com → API Keys |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` (default) | Set to `claude-opus-4-5` for max quality, `claude-haiku-4-5` for fast/cheap |

### HMRC MTD (IMPL-5)

| Variable | Value/Format | How to obtain |
|---|---|---|
| `HMRC_CLIENT_ID` | UUID string | HMRC Developer Hub → create application |
| `HMRC_CLIENT_SECRET` | String | HMRC Developer Hub → application credentials |
| `HMRC_BASE_URL` | `https://test-api.service.hmrc.gov.uk` (sandbox) or `https://api.service.hmrc.gov.uk` (prod) | HMRC Developer Hub |
| `HMRC_REDIRECT_URI` | `https://your-domain.com/api/hmrc/callback` | Must match exactly what is registered in HMRC Developer Hub |
| `HMRC_SCOPE` | `read:vat write:vat` | Set based on required API scopes |

**HMRC Developer Hub:** https://developer.service.hmrc.gov.uk

Steps to obtain:
1. Create an account at developer.service.hmrc.gov.uk
2. Create a new application
3. Subscribe to "VAT (MTD)" API for both sandbox and production
4. Get credentials from the application dashboard
5. Set `HMRC_REDIRECT_URI` to your Railway domain + `/api/hmrc/callback`
6. Test in sandbox first — sandbox VRNs are available in the HMRC Developer Hub test data

### TrueLayer Open Banking (IMPL-10)

| Variable | Value/Format | How to obtain |
|---|---|---|
| `TRUELAYER_CLIENT_ID` | UUID | console.truelayer.com → Create app |
| `TRUELAYER_CLIENT_SECRET` | String | console.truelayer.com → App credentials |
| `TRUELAYER_REDIRECT_URI` | `https://your-domain.com/api/truelayer/callback` | Must match TrueLayer dashboard setting |
| `TRUELAYER_SCOPES` | `accounts transactions balance` | Set based on required data |
| `TRUELAYER_ENV` | `sandbox` or `live` | Set to `sandbox` for development |

**TrueLayer Console:** https://console.truelayer.com

Steps to obtain:
1. Register at console.truelayer.com
2. Create a new application
3. Add `TRUELAYER_REDIRECT_URI` to allowed redirect URIs
4. Enable "Data API" permissions
5. Get client credentials from the app settings
6. UK bank coverage: covers Barclays, HSBC, Lloyds, NatWest, Santander, Monzo, Starling, etc.

---

## Missing for Phase 2

These are needed for Phase 2 features.

| Variable | Purpose | How to obtain |
|---|---|---|
| `COMPANIES_HOUSE_API_KEY` | Companies House API (IMPL-15) | developer.company-information.service.gov.uk |
| `XERO_CLIENT_ID` | Xero OAuth (if Xero import is added) | developer.xero.com |
| `XERO_CLIENT_SECRET` | Xero OAuth | developer.xero.com |
| `OPEN_BANKING_CLIENT_ID` | Alternative Open Banking provider | Provider-specific |
| `OPEN_BANKING_CLIENT_SECRET` | Alternative Open Banking provider | Provider-specific |
| `DATADOG_API_KEY` | APM / monitoring | datadoghq.com (or use Sentry) |
| `SENTRY_DSN` | Error tracking | sentry.io |
| `PGBOUNCER_URL` | PgBouncer connection pool | Railway add-on or separate PgBouncer service |

---

## Encryption Recommendations

The following variables contain OAuth tokens that will be stored in the database (`HmrcConnection.accessToken`, `HmrcConnection.refreshToken`, `BankFeedConnection.accessToken`). These should be encrypted at rest.

**Recommended approach:**
Add a `TOKEN_ENCRYPTION_KEY` environment variable (a 256-bit random hex string). Use AES-256-GCM to encrypt tokens before writing to the database and decrypt when reading.

| Variable | Purpose | How to generate |
|---|---|---|
| `TOKEN_ENCRYPTION_KEY` | AES-256 key for token encryption | `openssl rand -hex 32` |

Create `src/lib/crypto.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex')
const ALGO = 'aes-256-gcm'

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
```

---

## Complete env.example Template (updated)

```bash
# ── Core ────────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://username:password@localhost:5432/sumtise"
NODE_ENV=development
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# ── Auth (Clerk) ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/auth/signin"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/auth/signup"

# ── AI (Anthropic — Phase 1) ─────────────────────────────────────────────────
ANTHROPIC_API_KEY="sk-ant-api03-..."
ANTHROPIC_MODEL="claude-sonnet-4-6"

# ── AI (OpenAI — legacy, remove after IMPL-3 rollout) ────────────────────────
OPENAI_API_KEY="sk-..."

# ── HMRC MTD (Phase 1) ───────────────────────────────────────────────────────
HMRC_CLIENT_ID=""
HMRC_CLIENT_SECRET=""
HMRC_BASE_URL="https://test-api.service.hmrc.gov.uk"
HMRC_REDIRECT_URI="http://localhost:3000/api/hmrc/callback"
HMRC_SCOPE="read:vat write:vat"

# ── TrueLayer Open Banking (Phase 1) ─────────────────────────────────────────
TRUELAYER_CLIENT_ID=""
TRUELAYER_CLIENT_SECRET=""
TRUELAYER_REDIRECT_URI="http://localhost:3000/api/truelayer/callback"
TRUELAYER_SCOPES="accounts transactions balance"
TRUELAYER_ENV="sandbox"

# ── Token Encryption ─────────────────────────────────────────────────────────
TOKEN_ENCRYPTION_KEY=""  # Generate: openssl rand -hex 32

# ── File Storage ─────────────────────────────────────────────────────────────
FILE_STORAGE_PROVIDER=local
FILE_STORAGE_PATH=./uploads
FILE_MAX_SIZE=10485760
FILE_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/csv
FILE_ENABLE_VIRUS_SCAN=false

# AWS S3 (if FILE_STORAGE_PROVIDER=s3)
AWS_REGION=eu-west-2
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Google Cloud Storage (if FILE_STORAGE_PROVIDER=gcs)
GCS_PROJECT_ID=
GCS_BUCKET=
GCS_KEY_FILENAME=

# ── Email ────────────────────────────────────────────────────────────────────
EMAIL_PROVIDER=sandbox
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Sumtise
EMAIL_REPLY_TO=support@yourdomain.com
EMAIL_DOMAIN=yourdomain.com
EMAIL_SANDBOX_MODE=true

SENDGRID_API_KEY=
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
AWS_SES_REGION=eu-west-1
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=

# ── Job Security Tokens ───────────────────────────────────────────────────────
REMINDER_JOB_TOKEN=""    # Generate: openssl rand -hex 32
WORKFLOW_CHASE_SECRET="" # Generate: openssl rand -hex 32

# ── Phase 2 ──────────────────────────────────────────────────────────────────
COMPANIES_HOUSE_API_KEY=
SENTRY_DSN=
DATADOG_API_KEY=
```
