/**
 * Organization-scoped security guards
 * Ensures users can only access data from organizations they belong to
 */

import { TRPCError } from "@trpc/server"
import { prisma } from "@/lib/prisma"

/**
 * Verifies that a user is a member of an organization
 * @throws TRPCError with FORBIDDEN code if user is not a member
 */
export async function verifyOrganizationMembership(
  userId: string,
  organizationId: string
): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  })

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this organization",
    })
  }
}

/**
 * Verifies that a resource belongs to an organization
 * @throws TRPCError with FORBIDDEN code if resource doesn't belong to organization
 */
export async function verifyResourceOwnership(
  resourceType: "invoice" | "customer" | "vendor" | "bill" | "transaction" | "bankAccount" | "chartOfAccount" | "payment" | "paymentRun" | "creditNote" | "debitNote" | "journal" | "fixedAsset" | "helloItem" | "invoiceReminder" | "emailOutbox",
  resourceId: string,
  organizationId: string
): Promise<void> {
  let resource: { organizationId: string } | null = null

  switch (resourceType) {
    case "invoice":
      resource = await prisma.invoice.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "customer":
      resource = await prisma.customer.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "vendor":
      resource = await prisma.vendor.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "bill":
      resource = await prisma.bill.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "transaction":
      resource = await prisma.transaction.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "bankAccount":
      resource = await prisma.bankAccount.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "chartOfAccount":
      resource = await prisma.chartOfAccount.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "payment":
      resource = await prisma.payment.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "paymentRun":
      resource = await prisma.paymentRun.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "creditNote":
      resource = await prisma.creditNote.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break

    case "debitNote":
      resource = await prisma.debitNote.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break

    case "invoiceReminder":
      resource = await prisma.invoiceReminder.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "debitNote":
      resource = await prisma.debitNote.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "helloItem":
      resource = await prisma.helloItem.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    case "emailOutbox":
      resource = await prisma.emailOutbox.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      })
      break
    default:
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unknown resource type: ${resourceType}`,
      })
  }

  if (!resource) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${resourceType} not found`,
    })
  }

  if (resource.organizationId !== organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${resourceType} does not belong to this organization`,
    })
  }
}

/**
 * Gets organization ID from various input shapes
 */
export function getOrganizationIdFromInput(input: any): string | null {
  if (typeof input === "string") {
    return input
  }
  if (input?.organizationId) {
    return input.organizationId
  }
  if (input?.data?.organizationId) {
    return input.data.organizationId
  }
  return null
}

/**
 * Middleware helper to extract organization ID and verify membership
 */
export async function requireOrganizationAccess(
  userId: string,
  input: any
): Promise<string> {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    })
  }

  const organizationId = getOrganizationIdFromInput(input)
  if (!organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "organizationId is required",
    })
  }

  await verifyOrganizationMembership(userId, organizationId)
  return organizationId
}

