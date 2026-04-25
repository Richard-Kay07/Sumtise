/**
 * Email Router
 * 
 * Handles email sending for:
 * - Invoice emails
 * - Reminder emails
 * - Payment confirmation emails
 * 
 * Features:
 * - Template rendering
 * - PDF attachment support
 * - Outbox tracking
 * - Retry logic
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { createAndSendEmail, retryEmail } from "@/lib/email/outbox"
import { getTemplate, renderTemplate } from "@/lib/email/templates"
import { storage } from "@/lib/storage"

/**
 * Generate invoice PDF for email attachment
 * Reuses exportPDF logic but returns buffer directly
 */
async function generateInvoicePDFForEmail(invoice: any, organizationId: string): Promise<Buffer> {
  // Get organization settings for payment terms
  const orgSettings = await prisma.organizationSettings.findFirst({
    where: {
      organizationId,
      category: "ACCOUNTING",
    },
  })

  // Get organization data
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  })

  // Convert invoice to PDF data format
  const { convertInvoiceToPDFData } = await import("@/lib/pdf/invoice-helpers")
  const invoiceWithOrg = {
    ...invoice,
    organization: organization || { name: "Organization", address: null, email: null, phone: null, website: null, logo: null },
  }
  const pdfData = await convertInvoiceToPDFData(invoiceWithOrg, orgSettings)

  // Generate PDF
  const { generateInvoicePDF } = await import("@/lib/pdf/invoice")
  return await generateInvoicePDF(pdfData)
}

import { Prisma } from "@prisma/client"

/**
 * Email list query schema
 */
const emailListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  entityType: z.enum(["invoice", "reminder", "payment"]).optional(),
  entityId: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "FAILED", "CANCELLED"]).optional(),
  // Date range filters
  createdAtFrom: z.union([z.date(), z.string()]).optional(),
  createdAtTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["createdAt", "sentAt", "subject"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export const emailsRouter = createTRPCRouter({
  /**
   * Get all emails with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(emailListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        entityType,
        entityId,
        status,
        createdAtFrom,
        createdAtTo,
        sortBy,
        sortOrder,
      } = input

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
      }

      if (entityType) {
        where.entityType = entityType
      }

      if (entityId) {
        where.entityId = entityId
      }

      if (status) {
        where.status = status
      }

      // Date range filter
      if (createdAtFrom || createdAtTo) {
        where.createdAt = {}
        if (createdAtFrom) {
          const from = typeof createdAtFrom === "string" ? new Date(createdAtFrom) : createdAtFrom
          where.createdAt.gte = from
        }
        if (createdAtTo) {
          const to = typeof createdAtTo === "string" ? new Date(createdAtTo) : createdAtTo
          to.setHours(23, 59, 59, 999)
          where.createdAt.lte = to
        }
      }

      // Determine sort
      const orderBy: any = {}
      if (sortBy) {
        orderBy[sortBy] = sortOrder || "desc"
      } else {
        orderBy.createdAt = "desc"
      }

      // Execute paginated query
      const [emails, total] = await Promise.all([
        prisma.emailOutbox.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.emailOutbox.count({ where }),
      ])

      return {
        emails,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get email by ID
   */
  getById: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .query(async ({ ctx, input }) => {
      const email = await prisma.emailOutbox.findUnique({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      if (!email) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email not found",
        })
      }

      return email
    }),

  /**
   * Send invoice email
   * 
   * Sends invoice email with PDF attachment
   */
  sendInvoiceEmail: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      organizationId: z.string().min(1),
      invoiceId: z.string().min(1),
      to: z.array(z.string().email()).min(1, "At least one recipient is required"),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      includePdf: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const { invoiceId, to, cc, bcc, includePdf } = input

      // Verify invoice ownership
      await verifyResourceOwnership("invoice", invoiceId, ctx.organizationId)

      // Get invoice with customer
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: invoiceId,
          organizationId: ctx.organizationId,
        },
        include: {
          customer: true,
          items: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        })
      }

      // Get organization for company name
      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
      })

      // Prepare template variables
      const templateVars = {
        companyName: organization?.name || "Company",
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.date.toLocaleDateString(),
        dueDate: invoice.dueDate.toLocaleDateString(),
        currency: invoice.currency,
        total: invoice.total.toNumber(),
      }

      // Get invoice template
      const template = getTemplate("invoice")
      if (!template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invoice template not found",
        })
      }

      // Prepare attachments
      const attachments: Array<{
        filename: string
        content: Buffer | string
        contentType?: string
      }> = []

      // Add PDF if requested - generate or retrieve from storage
      if (includePdf) {
        let pdfBuffer: Buffer

        // Check if PDF already exists in invoice metadata
        const metadata = (invoice.metadata as any) || {}
        const pdfMetadata = metadata.pdf

        if (pdfMetadata?.path) {
          // Retrieve existing PDF from storage
          const { createStorageService } = await import("@/lib/storage")
          const storage = createStorageService()
          try {
            pdfBuffer = await storage.get(pdfMetadata.path)
          } catch (error) {
            // PDF not found in storage, generate new one
            pdfBuffer = await generateInvoicePDFForEmail(invoice, ctx.organizationId)
          }
        } else {
          // Generate new PDF
          pdfBuffer = await generateInvoicePDFForEmail(invoice, ctx.organizationId)
        }

        attachments.push({
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        })
      }

      // Send email
      const outboxEntry = await createAndSendEmail({
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        entityType: "invoice",
        entityId: invoiceId,
        to,
        cc,
        bcc,
        subject: renderTemplate(template.subject, templateVars),
        template: "invoice",
        templateVars,
        attachments: attachments.length > 0 ? attachments : undefined,
      })

      // Update invoice status to SENT if DRAFT
      if (invoice.status === "DRAFT") {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: "SENT" },
        })
      }

      // Record audit
      await recordAudit({
        entity: "email",
        entityId: outboxEntry.id,
        action: "send",
        after: outboxEntry,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          entityType: "invoice",
          entityId: invoiceId,
          recipients: to,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, emailId: outboxEntry.id })
      })

      return outboxEntry
    }),

  /**
   * Send reminder email
   * 
   * Sends reminder email for invoice
   */
  sendReminderEmail: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      organizationId: z.string().min(1),
      reminderId: z.string().min(1),
      to: z.array(z.string().email()).min(1, "At least one recipient is required"),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { reminderId, to, cc, bcc } = input

      // Get reminder with invoice
      const reminder = await prisma.invoiceReminder.findUnique({
        where: {
          id: reminderId,
          organizationId: ctx.organizationId,
        },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
        },
      })

      if (!reminder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        })
      }

      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
      })

      // Calculate days overdue
      const now = new Date()
      const daysOverdue = Math.floor(
        (now.getTime() - reminder.invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      const overdueStatus = daysOverdue > 0 ? "overdue" : "due soon"

      // Prepare template variables
      const templateVars = {
        companyName: organization?.name || "Company",
        customerName: reminder.invoice.customer.name,
        invoiceNumber: reminder.invoice.invoiceNumber,
        invoiceDate: reminder.invoice.date.toLocaleDateString(),
        dueDate: reminder.invoice.dueDate.toLocaleDateString(),
        currency: reminder.invoice.currency,
        balance: reminder.invoice.total.toNumber(), // Would calculate actual balance
        daysOverdue: Math.abs(daysOverdue),
        overdueStatus,
      }

      // Get reminder template
      const template = getTemplate("reminder")
      if (!template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Reminder template not found",
        })
      }

      // Send email
      const outboxEntry = await createAndSendEmail({
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        entityType: "reminder",
        entityId: reminderId,
        to,
        cc,
        bcc,
        subject: renderTemplate(template.subject, templateVars),
        template: "reminder",
        templateVars,
      })

      // Update reminder status
      await prisma.invoiceReminder.update({
        where: { id: reminderId },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      })

      // Record audit
      await recordAudit({
        entity: "email",
        entityId: outboxEntry.id,
        action: "send",
        after: outboxEntry,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          entityType: "reminder",
          entityId: reminderId,
          recipients: to,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, emailId: outboxEntry.id })
      })

      return outboxEntry
    }),

  /**
   * Send payment confirmation email
   * 
   * Sends payment confirmation to vendor
   */
  sendPaymentConfirmation: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.PAYMENTS_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      paymentId: z.string().min(1),
      to: z.array(z.string().email()).min(1, "At least one recipient is required"),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { paymentId, to, cc, bcc } = input

      // Verify payment ownership
      await verifyResourceOwnership("payment", paymentId, ctx.organizationId)

      // Get payment with vendor and bill
      const payment = await prisma.payment.findUnique({
        where: {
          id: paymentId,
          organizationId: ctx.organizationId,
        },
        include: {
          vendor: true,
          bill: true,
        },
      })

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment not found",
        })
      }

      // Get organization
      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
      })

      // Prepare template variables
      const templateVars = {
        companyName: organization?.name || "Company",
        vendorName: payment.vendor.name,
        paymentReference: payment.reference || payment.id,
        paymentDate: payment.paymentDate.toLocaleDateString(),
        currency: payment.currency,
        amount: payment.amount.toNumber(),
        paymentMethod: payment.method,
        billNumber: payment.bill?.billNumber || null,
      }

      // Get payment confirmation template
      const template = getTemplate("payment_confirmation")
      if (!template) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Payment confirmation template not found",
        })
      }

      // Send email
      const outboxEntry = await createAndSendEmail({
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        entityType: "payment",
        entityId: paymentId,
        to,
        cc,
        bcc,
        subject: renderTemplate(template.subject, templateVars),
        template: "payment_confirmation",
        templateVars,
      })

      // Record audit
      await recordAudit({
        entity: "email",
        entityId: outboxEntry.id,
        action: "send",
        after: outboxEntry,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          entityType: "payment",
          entityId: paymentId,
          recipients: to,
        },
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, emailId: outboxEntry.id })
      })

      return outboxEntry
    }),

  /**
   * Retry failed email
   */
  retry: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      id: z.string().min(1, "Email ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify email ownership
      await verifyResourceOwnership("emailOutbox", input.id, ctx.organizationId)

      const result = await retryEmail(input.id)

      // Record audit
      await recordAudit({
        entity: "email",
        entityId: input.id,
        action: "retry",
        after: result,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
      }).catch((error) => {
        ctx.logger?.warn("Audit recording failed", { error, emailId: input.id })
      })

      return result
    }),

  /**
   * Get email templates
   */
  getTemplates: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .query(async () => {
      const templates = [
        getTemplate("invoice"),
        getTemplate("reminder"),
        getTemplate("payment_confirmation"),
      ].filter(Boolean)

      return templates
    }),
})

