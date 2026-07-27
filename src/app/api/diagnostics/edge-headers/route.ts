/**
 * Edge header diagnostic — answers a specific HMRC compliance question.
 *
 * HMRC mandates `Gov-Client-Public-Port` (the END USER'S ephemeral TCP source
 * port) for the WEB_APP_VIA_SERVER connection method, and warns that "some
 * popular load balancers do not pass on users' public IPs or ports". Whether
 * our hosting forwards it determines whether we can be compliant at all, or
 * must negotiate an omission with SDSTeam@hmrc.gov.uk.
 *
 * There is no way to answer this except by observing a real inbound request in
 * the deployed environment.
 *
 * Safety: this reports ONLY the caller's own connection metadata back to the
 * caller (the same thing any "what is my IP" service does) plus which header
 * NAMES the edge forwarded. It exposes nothing about other users, no
 * application data, and no secrets.
 */

import { NextRequest, NextResponse } from "next/server"
import { extractClientNetwork } from "@/lib/hmrc/fraud-prevention"

export const dynamic = "force-dynamic"

/** Headers that could plausibly carry the client IP or source port. */
const CANDIDATES = [
  "x-forwarded-for",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-forwarded-host",
  "x-real-ip",
  "x-real-port",
  "x-client-ip",
  "x-client-port",
  "cf-connecting-ip",
  "cf-connecting-port",
  "cf-ray",
  "true-client-ip",
  "fly-client-ip",
  "x-envoy-external-address",
  "forwarded",
  "x-railway-request-id",
  "x-railway-edge",
]

export async function GET(req: NextRequest) {
  const present: Record<string, string> = {}
  for (const name of CANDIDATES) {
    const v = req.headers.get(name)
    if (v) present[name] = v
  }

  // What our production code would actually derive from this request.
  const derived = extractClientNetwork(req.headers)

  return NextResponse.json(
    {
      question: "Does this platform forward the client's public IP and TCP source port?",
      derived: {
        clientPublicIp: derived.clientPublicIp || null,
        clientPublicPort: derived.clientPublicPort ?? null,
        clientPublicIpTimestamp: derived.clientPublicIpTimestamp,
      },
      verdict: {
        canSendGovClientPublicIp: !!derived.clientPublicIp,
        canSendGovClientPublicPort: !!derived.clientPublicPort,
      },
      forwardedHeadersPresent: present,
      // Every header name the edge sent, so we can spot anything unexpected.
      allHeaderNames: Array.from(req.headers.keys()).sort(),
    },
    { headers: { "cache-control": "no-store" } },
  )
}
