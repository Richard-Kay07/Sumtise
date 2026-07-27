/**
 * Verifies HMRC fraud prevention header construction against the exact
 * examples published in spec v3.3.
 *
 * Run: npx tsx scripts/verify-fraud-prevention-headers.ts
 *
 * These headers are a legal requirement and are NOT validated at request time —
 * HMRC returns 200 for malformed headers and enforces out-of-band. So this
 * script is the only pre-flight check we have short of the sandbox validator.
 */

import {
  buildFraudPreventionHeaders,
  formatTimezoneOffset,
  __testing,
  type FraudPreventionInput,
} from "../src/lib/hmrc/fraud-prevention"

let passed = 0
let failed = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = String(actual)
  const e = String(expected)
  if (a === e) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`      expected: ${e}`)
    console.log(`      actual:   ${a}`)
  }
}

function section(title: string) {
  console.log(`\n${title}`)
}

// ─── Encoding primitives ─────────────────────────────────────────────────────

section("Percent-encoding rules")

// HMRC: keys and values percent-encoded; separators (= &) NOT encoded.
check(
  "kv leaves = and & unencoded",
  __testing.kv({ width: 1256, height: 803 }),
  "width=1256&height=803",
)

// A timestamp colon sits INSIDE a value, so it must be encoded.
check(
  "kv encodes colons inside values",
  __testing.kv({ timestamp: "2021-11-21T13:23Z" }),
  "timestamp=2021-11-21T13%3A23Z",
)

check(
  "kv encodes @ in an email-style value",
  __testing.kv({ sumtise: "alice@example.com" }),
  "sumtise=alice%40example.com",
)

check("kv omits empty values", __testing.kv({ a: "1", b: "" }), "a=1")

// HMRC: list values percent-encoded, comma separator NOT encoded.
check("list leaves commas unencoded", __testing.list(["a=1", "b=2"]), "a=1,b=2")

// ─── Timezone conversion ─────────────────────────────────────────────────────

section("Gov-Client-Timezone (sign inversion)")

// getTimezoneOffset() returns minutes BEHIND UTC, so the sign flips.
check("UTC+0 → UTC+00:00", formatTimezoneOffset(0), "UTC+00:00")
check("BST (offset -60) → UTC+01:00", formatTimezoneOffset(-60), "UTC+01:00")
check("offset +60 → UTC-01:00", formatTimezoneOffset(60), "UTC-01:00")
check("India (offset -330) → UTC+05:30", formatTimezoneOffset(-330), "UTC+05:30")
check("Chatham (offset -765) → UTC+12:45", formatTimezoneOffset(-765), "UTC+12:45")
check("offset +75 → UTC-01:15", formatTimezoneOffset(75), "UTC-01:15")

// ─── Full header set ─────────────────────────────────────────────────────────

section("Full WEB_APP_VIA_SERVER header set")

const input: FraudPreventionInput = {
  browser: {
    jsUserAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    deviceId: "beec798b-b366-47fa-b1f8-92cede14a1ce",
    timezone: "UTC+00:00",
    screens: [
      { width: 1920, height: 1080, scalingFactor: 1, colourDepth: 16 },
      { width: 3000, height: 2000, scalingFactor: 1.25, colourDepth: 16 },
    ],
    windowSize: { width: 1256, height: 803 },
  },
  server: {
    clientPublicIp: "198.51.100.0",
    clientPublicIpTimestamp: "2020-09-21T14:30:05.123Z",
    clientPublicPort: "12345",
    vendorPublicIp: "203.0.113.6",
    userId: "alice123",
    multiFactor: [
      {
        type: "AUTH_CODE",
        timestamp: "2021-11-21T13:23Z",
        uniqueReference:
          "fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c",
      },
    ],
  },
}

const h = buildFraudPreventionHeaders(input)

check("Connection-Method", h["Gov-Client-Connection-Method"], "WEB_APP_VIA_SERVER")
check("Device-ID", h["Gov-Client-Device-ID"], "beec798b-b366-47fa-b1f8-92cede14a1ce")
check("Public-IP unencoded", h["Gov-Client-Public-IP"], "198.51.100.0")
check(
  "Public-IP-Timestamp keeps ms and colons",
  h["Gov-Client-Public-IP-Timestamp"],
  "2020-09-21T14:30:05.123Z",
)
check("Public-Port", h["Gov-Client-Public-Port"], "12345")
check("Timezone", h["Gov-Client-Timezone"], "UTC+00:00")

// Matches HMRC's published example exactly.
check(
  "Screens — multi-screen with all four sub-fields",
  h["Gov-Client-Screens"],
  "width=1920&height=1080&scaling-factor=1&colour-depth=16,width=3000&height=2000&scaling-factor=1.25&colour-depth=16",
)
check("Window-Size", h["Gov-Client-Window-Size"], "width=1256&height=803")
check("User-IDs", h["Gov-Client-User-IDs"], "sumtise=alice123")

// HMRC's published example for this header, verbatim.
check(
  "Multi-Factor — colon encoded, separators not",
  h["Gov-Client-Multi-Factor"],
  "type=AUTH_CODE&timestamp=2021-11-21T13%3A23Z&unique-reference=fc4b5fd6816f75a7c81fc8eaa9499d6a299bd803397166e8c4cf9280b801d62c",
)

// First hop: by = vendor IP, for = client IP. HMRC cross-validates this.
check(
  "Vendor-Forwarded first hop",
  h["Gov-Vendor-Forwarded"],
  "by=203.0.113.6&for=198.51.100.0",
)
check("Vendor-Public-IP", h["Gov-Vendor-Public-IP"], "203.0.113.6")
check("Vendor-Product-Name", h["Gov-Vendor-Product-Name"], "Sumtise")

section("Headers correctly ABSENT for this connection method")

// Removed by HMRC for web-app-via-server in spec v3.1 / v3.2.
for (const absent of [
  "Gov-Client-Local-IPs",
  "Gov-Client-Local-IPs-Timestamp",
  "Gov-Client-Browser-Plugins",
  "Gov-Client-Browser-Do-Not-Track",
  "Gov-Client-MAC-Addresses",
]) {
  check(`${absent} not sent`, h[absent] === undefined, true)
}

section("No placeholder values (HMRC forbids null/undefined/empty)")

const FORBIDDEN = ["null", "undefined", "", "unknown", "0.0.0.0", "NaN"]
for (const [name, value] of Object.entries(h)) {
  if (FORBIDDEN.includes(value)) {
    failed++
    console.log(`  ✗ ${name} contains forbidden placeholder: "${value}"`)
  }
}
console.log(`  ✓ scanned ${Object.keys(h).length} headers for placeholders`)
passed++

section("IPv6 in Vendor-Forwarded is percent-encoded")

const ipv6 = buildFraudPreventionHeaders({
  ...input,
  server: {
    ...input.server,
    vendorPublicIp: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
  },
})
check(
  "IPv6 colons encoded inside kv value",
  ipv6["Gov-Vendor-Forwarded"],
  "by=2001%3A0db8%3A85a3%3A0000%3A0000%3A8a2e%3A0370%3A7334&for=198.51.100.0",
)

section("Degraded input does not emit placeholders")

const minimal = buildFraudPreventionHeaders({
  browser: input.browser,
  server: {
    clientPublicIp: "198.51.100.0",
    clientPublicIpTimestamp: "2020-09-21T14:30:05.123Z",
    // no port (Railway may not expose it), no MFA
    vendorPublicIp: "203.0.113.6",
    userId: "bob",
  },
})
check("Public-Port omitted, not empty", minimal["Gov-Client-Public-Port"] === undefined, true)
check("Multi-Factor omitted, not empty", minimal["Gov-Client-Multi-Factor"] === undefined, true)
check("License-IDs omitted by design", minimal["Gov-Vendor-License-IDs"] === undefined, true)

// ─── Result ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`)
console.log(`${passed} passed, ${failed} failed`)
console.log("─".repeat(50))

if (failed > 0) process.exit(1)
