/**
 * Mirror the authenticated Clerk user into the local `User` table.
 *
 * WHY THIS IS NECESSARY
 * ---------------------
 * Authentication is Clerk's, but every ownership relation in the schema points
 * at the local `User` table: `Organization.creatorId`, `OrganizationMember.userId`,
 * `AuditLog.userId`. `ctx.userId` is the CLERK id (`user_3Cyb…`) and
 * `OrganizationMember.userId` is matched directly against it, so the local row's
 * primary key must BE the Clerk id.
 *
 * Nothing was creating that row — no `user.created` webhook, no provisioning on
 * first request — which left a new sign-in unable to do anything:
 *
 *   - `getUserOrganizations` matches on `OrganizationMember.userId` → returns []
 *     → the org context sets `orgId` to "" → every org-scoped control is
 *     disabled.
 *   - `organization.create` sets `creatorId: ctx.userId`, a foreign key to
 *     `User.id` → constraint violation.
 *
 * WHY THERE IS NO STATIC CLERK IMPORT HERE
 * ----------------------------------------
 * `import { clerkClient } from "@clerk/nextjs/server"` type-checks and builds
 * cleanly — the symbol is in Clerk 6.39's `.d.ts` — but it is NOT present at
 * runtime. A static named import therefore resolved to undefined (or threw on
 * module evaluation), which broke this module, and with it every consumer of the
 * app router. The symptom was the whole application reporting no organisation.
 *
 * So Clerk is reached only through a guarded dynamic import, and any failure
 * degrades to a placeholder email rather than breaking the request. The row's
 * ONLY hard requirement is that it exists so the foreign keys resolve.
 */

import { prisma } from "@/lib/prisma"

/** Deterministic, obviously-not-real address. Never collides across users. */
const placeholderEmail = (clerkUserId: string) =>
  `${clerkUserId}@users.noreply.sumtise.local`

interface ClerkProfile {
  email?: string
  name?: string | null
  image?: string | null
}

/**
 * Best-effort profile lookup. Returns an empty object on any failure — a
 * missing display name must never stop a user from reaching their data.
 */
async function tryReadClerkProfile(clerkUserId: string): Promise<ClerkProfile> {
  try {
    const mod: Record<string, unknown> = await import("@clerk/nextjs/server")
    const candidate = mod.clerkClient
    if (!candidate) return {}

    // Clerk has shipped this both as an object and as an async factory.
    const client: any =
      typeof candidate === "function" ? await (candidate as () => Promise<any>)() : candidate
    if (!client?.users?.getUser) return {}

    const u = await client.users.getUser(clerkUserId)
    const primary =
      u.emailAddresses?.find((e: any) => e.id === u.primaryEmailAddressId) ??
      u.emailAddresses?.[0]

    return {
      email: primary?.emailAddress ?? undefined,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
      image: u.imageUrl ?? null,
    }
  } catch {
    return {}
  }
}

/**
 * Ensure a local `User` row exists whose id equals the Clerk user id.
 * Idempotent, cheap on the hot path (one indexed lookup), and never throws.
 */
export async function ensureUserRecord(clerkUserId: string): Promise<void> {
  if (!clerkUserId) return

  try {
    const existing = await prisma.user.findUnique({
      where: { id: clerkUserId },
      select: { id: true },
    })
    if (existing) return

    const profile = await tryReadClerkProfile(clerkUserId)

    // `email` is unique. Prefer the real address, but never let a collision or
    // a failed profile read block provisioning.
    for (const email of [profile.email, placeholderEmail(clerkUserId)]) {
      if (!email) continue
      try {
        await prisma.user.create({
          data: {
            id: clerkUserId,
            email,
            name: profile.name ?? null,
            image: profile.image ?? null,
            emailVerified: new Date(),
          },
        })
        return
      } catch {
        // Unique violation on email, or a concurrent request already created
        // the row. Re-check before trying the fallback address.
        const now = await prisma.user.findUnique({
          where: { id: clerkUserId },
          select: { id: true },
        })
        if (now) return
      }
    }
  } catch (err) {
    // Provisioning is a convenience, not a gate. A user who is already a member
    // of an organisation must still be able to load the application.
    console.error("[ensureUserRecord] provisioning failed for", clerkUserId, err)
  }
}
