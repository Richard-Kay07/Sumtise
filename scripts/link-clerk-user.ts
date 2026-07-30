/**
 * Link a Clerk account to an organisation.
 *
 * Needed because nothing in the app provisions a Prisma `User` row or an
 * `OrganizationMember` row for a Clerk sign-in. `getUserOrganizations` matches
 * `OrganizationMember.userId` against the CLERK user id, so an unlinked account
 * sees no organisations, `orgId` is empty, and every org-scoped control in the
 * UI is disabled with no explanation.
 *
 * Usage: npx tsx scripts/link-clerk-user.ts <clerkUserId> <email> <orgSlug> [role]
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const [clerkUserId, email, orgSlug, role = "OWNER"] = process.argv.slice(2)
  if (!clerkUserId || !email || !orgSlug) {
    console.error("Usage: npx tsx scripts/link-clerk-user.ts <clerkUserId> <email> <orgSlug> [role]")
    process.exit(1)
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) throw new Error(`No organisation with slug "${orgSlug}"`)

  // The Prisma User id must equal the Clerk user id — that is the join key.
  const user = await prisma.user.upsert({
    where:  { id: clerkUserId },
    update: { email },
    create: { id: clerkUserId, email, name: email.split("@")[0] },
  })
  console.log(`user:       ${user.id} (${user.email})`)

  const member = await prisma.organizationMember.upsert({
    where:  { userId_organizationId: { userId: clerkUserId, organizationId: org.id } },
    update: { role: role as any },
    create: { userId: clerkUserId, organizationId: org.id, role: role as any },
  })
  console.log(`membership: ${member.role} of ${org.name}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1) })
