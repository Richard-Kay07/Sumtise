/**
 * Reports what the server resolves for the CALLER'S OWN session.
 *
 * Diagnosing "organizationId is required" from a developer machine is
 * unreliable: curl authenticates with a Bearer token, whereas a browser uses a
 * Clerk cookie session. Those take different code paths, so a working curl
 * proves nothing about the browser. This endpoint runs the real resolution
 * chain — cookie session first, Bearer fallback second — and reports what the
 * membership lookup actually returns for whoever calls it.
 *
 * Safety: returns only the caller's own identity and organisation names. No
 * other user's data, no financial data, no secrets.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { verifyToken } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const out: Record<string, unknown> = {
    note: "Server-side view of your own session. Safe to share.",
  }

  // 1 — cookie session (what a browser normally uses)
  let cookieUserId: string | null = null
  try {
    const session = await auth()
    cookieUserId = session?.userId ?? null
    out.cookieSession = { userId: cookieUserId, resolved: !!cookieUserId }
  } catch (err) {
    out.cookieSession = { error: (err as Error).message, resolved: false }
  }

  // 2 — Bearer token fallback (what the tRPC client sends)
  let bearerUserId: string | null = null
  const authHeader = req.headers.get("authorization")
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (bearer) {
    try {
      const payload = await verifyToken(bearer, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      })
      bearerUserId = payload.sub ?? null
      out.bearerToken = { present: true, userId: bearerUserId }
    } catch (err) {
      out.bearerToken = { present: true, error: (err as Error).message }
    }
  } else {
    out.bearerToken = { present: false }
  }

  const effectiveUserId = cookieUserId ?? bearerUserId
  out.effectiveUserId = effectiveUserId

  if (!effectiveUserId) {
    out.verdict = "NOT AUTHENTICATED — the server cannot identify you at all."
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } })
  }

  // 3 — exactly what getUserOrganizations runs
  try {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: effectiveUserId },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: "asc" },
    })
    out.memberships = memberships.map((m) => ({
      role: m.role,
      organizationId: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
    }))

    const userRow = await prisma.user.findUnique({
      where: { id: effectiveUserId },
      select: { id: true, email: true },
    })
    out.localUserRow = userRow ?? "MISSING"

    out.verdict =
      memberships.length > 0
        ? `OK — ${memberships.length} organisation(s). The browser should have an orgId.`
        : "NO MEMBERSHIPS — this account belongs to no organisation, so orgId will be empty."
  } catch (err) {
    out.memberships = { error: (err as Error).message }
    out.verdict = "DATABASE ERROR during the membership lookup."
  }

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } })
}
