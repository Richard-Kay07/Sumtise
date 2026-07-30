/**
 * Mirror the authenticated Clerk user into the local `User` table.
 *
 * WHY THIS IS NECESSARY
 * ---------------------
 * Authentication is Clerk's, but every ownership relation in the schema points
 * at the local `User` table: `Organization.creatorId`, `OrganizationMember.userId`,
 * `AuditLog.userId`, and so on. `ctx.userId` is the CLERK id
 * (`user_3Cyb…`), and `OrganizationMember.userId` is matched directly against
 * it — so the local row's primary key must BE the Clerk id.
 *
 * Nothing was creating that row. There is no `user.created` webhook handler and
 * no provisioning on first request, which left a new sign-in unable to do
 * anything at all:
 *
 *   - `getUserOrganizations` matches on `OrganizationMember.userId` → returns []
 *     → the org context sets `orgId` to "" → every org-scoped control in the UI
 *     is disabled, with no explanation shown to the user.
 *   - `organization.create` sets `creatorId: ctx.userId`, a foreign key to
 *     `User.id` → fails with a constraint violation.
 *
 * So a new account could neither join an organisation nor create one. Calling
 * this before either path closes that hole.
 */

import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

/**
 * Ensure a local `User` row exists whose id equals the Clerk user id.
 * Idempotent and safe to call on every authenticated request.
 */
export async function ensureUserRecord(clerkUserId: string): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { id: clerkUserId },
    select: { id: true },
  })
  if (existing) return

  // Only reach out to Clerk when we actually have to create the row.
  let email = `${clerkUserId}@placeholder.local`
  let name: string | null = null
  let image: string | null = null

  try {
    const client = await clerkClient()
    const u = await client.users.getUser(clerkUserId)
    const primary =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ??
      u.emailAddresses[0]
    if (primary?.emailAddress) email = primary.emailAddress
    name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null
    image = u.imageUrl ?? null
  } catch (err) {
    // A placeholder email is better than blocking the request outright: the
    // row exists so the foreign keys resolve, and it is corrected on the next
    // successful lookup.
    console.error("[ensureUserRecord] could not read Clerk profile", clerkUserId, err)
  }

  try {
    await prisma.user.create({
      data: { id: clerkUserId, email, name, image, emailVerified: new Date() },
    })
  } catch (err) {
    // Two concurrent requests can race here, and `email` is unique — if another
    // request won, or the address already belongs to a pre-existing row, fall
    // back to a deterministic address so provisioning still succeeds.
    const stillMissing = !(await prisma.user.findUnique({
      where: { id: clerkUserId },
      select: { id: true },
    }))
    if (stillMissing) {
      await prisma.user.create({
        data: {
          id: clerkUserId,
          email: `${clerkUserId}@users.noreply.sumtise.com`,
          name,
          image,
          emailVerified: new Date(),
        },
      })
    }
  }
}
