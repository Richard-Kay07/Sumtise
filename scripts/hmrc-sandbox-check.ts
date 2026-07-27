/**
 * Validates our real fraud prevention headers against HMRC's Test Fraud
 * Prevention Headers API in the sandbox.
 *
 * HMRC will not grant production credentials until they see correctly formed
 * headers, and they are not validated at request time — a malformed header
 * returns 200 and surfaces later as a compliance letter. This is the only
 * authoritative pre-flight check available.
 *
 * Run: npx tsx scripts/hmrc-sandbox-check.ts
 * Requires HMRC_CLIENT_ID / HMRC_CLIENT_SECRET in .env
 */

import { readFileSync } from "fs"
import { buildFraudPreventionHeaders, type FraudPreventionInput } from "../src/lib/hmrc/fraud-prevention"

// Minimal .env loader — avoids adding a dependency just for a dev script.
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)
  if (m) process.env[m[1]] ??= m[2]
}

const BASE = "https://test-api.service.hmrc.gov.uk"

async function appToken(): Promise<string> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.HMRC_CLIENT_ID!,
      client_secret: process.env.HMRC_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  })
  if (!res.ok) throw new Error(`token failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

// Representative of what a real browser + our server would produce.
const input: FraudPreventionInput = {
  browser: {
    jsUserAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceId: "beec798b-b366-47fa-b1f8-92cede14a1ce",
    timezone: "UTC+00:00",
    screens: [{ width: 1920, height: 1080, scalingFactor: 2, colourDepth: 24 }],
    windowSize: { width: 1440, height: 900 },
  },
  server: {
    clientPublicIp: "198.51.100.42",
    clientPublicIpTimestamp: new Date().toISOString(),
    clientPublicPort: "54321",
    vendorPublicIp: "203.0.113.7",
    userId: "sandbox-check-user",
    multiFactor: [
      {
        type: "AUTH_CODE",
        timestamp: new Date().toISOString().slice(0, 16) + "Z",
        uniqueReference:
          "fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c",
      },
    ],
  },
}

async function main() {
  const token = await appToken()
  const fph = buildFraudPreventionHeaders(input)

  console.log(`Sending ${Object.keys(fph).length} fraud prevention headers to HMRC's validator…\n`)
  for (const [k, v] of Object.entries(fph)) {
    console.log(`  ${k}: ${v.length > 76 ? v.slice(0, 76) + "…" : v}`)
  }

  const res = await fetch(`${BASE}/test/fraud-prevention-headers/validate`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.hmrc.1.0+json",
      ...fph,
    },
  })

  const body = await res.json()

  console.log(`\n${"─".repeat(62)}`)
  console.log(`HMRC verdict: ${body.code}   (spec ${body.specVersion})`)
  console.log(body.message)
  console.log("─".repeat(62))

  if (body.errors?.length) {
    console.log("\nERRORS — these block production credentials:")
    for (const e of body.errors) {
      console.log(`  ✗ [${e.code}] ${e.headers?.join(", ")}`)
      console.log(`      ${e.message}`)
    }
  }

  if (body.warnings?.length) {
    console.log("\nADVISORIES:")
    for (const w of body.warnings) {
      console.log(`  ! [${w.code}] ${w.headers?.join(", ")}`)
      console.log(`      ${w.message}`)
    }
  }

  if (!body.errors?.length && !body.warnings?.length) {
    console.log("\nNo errors, no advisories.")
  }

  process.exit(body.code === "INVALID_HEADERS" ? 1 : 0)
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exit(1)
})
