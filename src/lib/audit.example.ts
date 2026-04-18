/**
 * Audit Trail Usage Examples
 * 
 * This file demonstrates how to use the audit trail utility
 * in various scenarios throughout the Sumtise application.
 */

import { recordAudit, recordAuditFromContext, getAuditTrail } from "@/lib/audit"
import { orgScopedProcedure } from "@/lib/trpc"
import { prisma } from "@/lib/prisma"

// ============================================================================
// Example 1: Recording audit in tRPC router (create operation)
// ============================================================================

export const invoiceRouter = {
  create: orgScopedProcedure
    .input(/* ... */)
    .mutation(async ({ ctx, input }) => {
      // Create invoice
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          // ... invoice data
        },
      })

      // Record audit trail
      await recordAuditFromContext(ctx, {
        entity: "invoice",
        entityId: invoice.id,
        action: "create",
        after: {
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          status: invoice.status,
        },
        details: `Invoice ${invoice.invoiceNumber} created`,
      })

      return invoice
    }),
}

// ============================================================================
// Example 2: Recording audit for update operation
// ============================================================================

export const updateInvoiceExample = async (
  ctx: { session: any; organizationId: string },
  invoiceId: string,
  updateData: any
) => {
  // Get current state
  const oldInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  })

  // Update invoice
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
  })

  // Record audit trail with before/after comparison
  await recordAuditFromContext(ctx, {
    entity: "invoice",
    entityId: invoiceId,
    action: "update",
    before: {
      status: oldInvoice?.status,
      total: oldInvoice?.total,
      dueDate: oldInvoice?.dueDate,
    },
    after: {
      status: updatedInvoice.status,
      total: updatedInvoice.total,
      dueDate: updatedInvoice.dueDate,
    },
    details: "Invoice updated",
  })

  return updatedInvoice
}

// ============================================================================
// Example 3: Recording audit for delete operation
// ============================================================================

export const deleteInvoiceExample = async (
  ctx: { session: any; organizationId: string },
  invoiceId: string
) => {
  // Get current state before deletion
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  })

  // Soft delete
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { deletedAt: new Date() },
  })

  // Record audit trail
  await recordAuditFromContext(ctx, {
    entity: "invoice",
    entityId: invoiceId,
    action: "delete",
    before: {
      invoiceNumber: invoice?.invoiceNumber,
      status: invoice?.status,
      total: invoice?.total,
    },
    details: `Invoice ${invoice?.invoiceNumber} deleted`,
  })
}

// ============================================================================
// Example 4: Recording audit with metadata
// ============================================================================

export const processPaymentExample = async (
  ctx: { session: any; organizationId: string },
  paymentRunId: string
) => {
  // Process payment run
  const paymentRun = await prisma.paymentRun.update({
    where: { id: paymentRunId },
    data: { status: "COMPLETED" },
  })

  // Record audit with metadata
  await recordAuditFromContext(ctx, {
    entity: "paymentRun",
    entityId: paymentRunId,
    action: "process",
    after: {
      status: paymentRun.status,
      totalAmount: paymentRun.totalAmount,
    },
    meta: {
      paymentCount: 10,
      paymentMethod: "BACS",
      fileReference: "PAY-2024-001",
    },
    details: "Payment run processed successfully",
  })
}

// ============================================================================
// Example 5: Recording audit for custom actions
// ============================================================================

export const sendInvoiceExample = async (
  ctx: { session: any; organizationId: string },
  invoiceId: string
) => {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "SENT" },
  })

  // Record custom action
  await recordAuditFromContext(ctx, {
    entity: "invoice",
    entityId: invoiceId,
    action: "send",
    after: {
      status: invoice.status,
    },
    meta: {
      emailSent: true,
      recipient: "customer@example.com",
      sentAt: new Date().toISOString(),
    },
    details: `Invoice ${invoice.invoiceNumber} sent to customer`,
  })
}

// ============================================================================
// Example 6: Recording audit for approval workflow
// ============================================================================

export const approveBillAmendmentExample = async (
  ctx: { session: any; organizationId: string },
  amendmentId: string
) => {
  const amendment = await prisma.billAmendment.findUnique({
    where: { id: amendmentId },
  })

  const updatedAmendment = await prisma.billAmendment.update({
    where: { id: amendmentId },
    data: {
      status: "APPROVED",
      approvedBy: ctx.session.user.id,
      approvedAt: new Date(),
    },
  })

  // Record approval audit
  await recordAuditFromContext(ctx, {
    entity: "billAmendment",
    entityId: amendmentId,
    action: "approve",
    before: {
      status: amendment?.status,
    },
    after: {
      status: updatedAmendment.status,
      approvedBy: updatedAmendment.approvedBy,
      approvedAt: updatedAmendment.approvedAt,
    },
    details: "Bill amendment approved",
  })
}

// ============================================================================
// Example 7: Retrieving audit trail
// ============================================================================

export const getInvoiceAuditTrailExample = async (
  organizationId: string,
  invoiceId: string
) => {
  // Get audit trail for specific invoice
  const auditTrail = await getAuditTrail(
    organizationId,
    "invoice",
    invoiceId,
    50 // limit
  )

  return auditTrail
}

// ============================================================================
// Example 8: Using in transaction with error handling
// ============================================================================

export const createInvoiceWithAuditExample = async (
  ctx: { session: any; organizationId: string },
  invoiceData: any
) => {
  try {
    // Create invoice in transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          ...invoiceData,
        },
      })

      // Record audit within transaction
      await recordAudit({
        entity: "invoice",
        entityId: newInvoice.id,
        action: "create",
        after: {
          invoiceNumber: newInvoice.invoiceNumber,
          total: newInvoice.total,
        },
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        details: `Invoice ${newInvoice.invoiceNumber} created`,
      })

      return newInvoice
    })

    return invoice
  } catch (error) {
    // Error handling - audit is automatically rolled back if transaction fails
    throw error
  }
}

// ============================================================================
// Example 9: Recording audit with IP address and user agent
// ============================================================================

export const recordAuditWithRequestInfo = async (
  ctx: { session: any; organizationId: string },
  req: { ip?: string; headers: { "user-agent"?: string } },
  entity: string,
  entityId: string,
  action: string,
  before?: any,
  after?: any
) => {
  await recordAudit({
    entity: entity as any,
    entityId,
    action: action as any,
    before,
    after,
    organizationId: ctx.organizationId,
    userId: ctx.session.user.id,
    ipAddress: req.ip || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
  })
}

