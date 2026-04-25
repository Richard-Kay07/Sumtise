/**
 * Invoice Reminders Router
 * 
 * Handles invoice reminder scheduling and sending with:
 * - Reminder scheduling
 * - Outstanding invoice selection (with cool-down)
 * - Single and bulk reminder sending
 * - Email outbox entry creation
 * - Template management with placeholders
 * - Cool-down period enforcement
 */

import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { createTRPCRouter, orgScopedProcedure, requirePermissionProcedure } from "@/lib/trpc"
import { Permission } from "@/lib/permissions"
import { paginationSchema } from "@/types/schemas"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { verifyResourceOwnership } from "@/lib/guards/organization"
import { createAndSendEmail } from "@/lib/email/outbox"
import { getTemplate, renderTemplate } from "@/lib/email/templates"
import { Prisma, InvoiceStatus, ReminderType, ReminderStatus } from "@prisma/client"

/**
 * Reminder list query schema with filters
 */
const reminderListSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  ...paginationSchema.shape,
  // Filters
  invoiceId: z.string().optional(),
  reminderType: z.enum(["FIRST", "SECOND", "FINAL", "CUSTOM"]).optional(),
  status: z.enum(["PENDING", "SENT", "FAILED", "CANCELLED"]).optional(),
  // Date range filters
  scheduledFrom: z.union([z.date(), z.string()]).optional(),
  scheduledTo: z.union([z.date(), z.string()]).optional(),
  // Sort
  sortBy: z.enum(["scheduledFor", "createdAt", "sentAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

/**
 * Get outstanding invoices for reminders
 * 
 * Rules:
 * - Status not PAID/CANCELLED
 * - Due before/within X days
 * - Exclude already reminded within cool-down period
 */
async function getOutstandingInvoices(
  organizationId: string,
  options: {
    daysBeforeDue?: number // Days before due date to remind
    daysOverdue?: number // Days overdue to include
    cooldownDays?: number // Cool-down period in days
  }
) {
  const { daysBeforeDue = 0, daysOverdue = 365, cooldownDays = 7 } = options

  const now = new Date()
  const dueDateThreshold = new Date(now)
  dueDateThreshold.setDate(dueDateThreshold.getDate() + daysBeforeDue)

  const overdueThreshold = new Date(now)
  overdueThreshold.setDate(overdueThreshold.getDate() - daysOverdue)

  const cooldownThreshold = new Date(now)
  cooldownThreshold.setDate(cooldownThreshold.getDate() - cooldownDays)

  // Get all invoices that need reminders
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: {
        notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
      },
      dueDate: {
        lte: dueDateThreshold, // Due on or before threshold
        gte: overdueThreshold, // Not too old
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reminders: {
        where: {
          sentAt: {
            gte: cooldownThreshold, // Sent within cool-down period
          },
          status: ReminderStatus.SENT,
        },
        orderBy: {
          sentAt: "desc",
        },
        take: 1, // Just need to check if any recent reminder exists
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  })

  // Filter out invoices that have been reminded within cool-down period
  const outstandingInvoices = invoices
    .filter((invoice) => {
      // Exclude if reminded within cool-down
      if (invoice.reminders.length > 0) {
        return false
      }
      return true
    })
    .map((invoice) => {
      // Calculate days until/since due date
      const daysUntilDue = Math.ceil(
        (invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      const isOverdue = daysUntilDue < 0
      const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        dueDate: invoice.dueDate,
        customer: invoice.customer,
        status: invoice.status,
        total: invoice.total.toNumber(),
        currency: invoice.currency,
        daysUntilDue,
        isOverdue,
        daysOverdue,
        lastReminderSentAt: null, // No recent reminders
      }
    })

  return outstandingInvoices
}

/**
 * Create email outbox entry
 * 
 * Creates an outbox entry that can be processed later by an email service.
 * In a full implementation, this would be a separate EmailOutbox table.
 * For now, we return the entry structure that can be stored/queried.
 */
async function createEmailOutboxEntry(
  reminderId: string,
  invoice: any,
  template: string,
  payload: any
) {
  const outboxEntry = {
    id: `outbox-${reminderId}-${Date.now()}`,
    reminderId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerEmail: invoice.customer?.email,
    customerName: invoice.customer?.name,
    template,
    payload,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  }

  // In a full implementation, this would insert into EmailOutbox table:
  // await prisma.emailOutbox.create({ data: outboxEntry })
  // For now, the entry is returned and can be processed by email service

  return outboxEntry
}

/**
 * Get outbox entries from reminders
 * 
 * Retrieves all outbox entries from sent reminders.
 * In a full implementation, this would query EmailOutbox table directly.
 */
async function getOutboxEntries(organizationId: string, filters?: {
  status?: string
  invoiceId?: string
}) {
  const where: any = {
    organizationId,
    status: ReminderStatus.SENT,
    sentAt: { not: null },
  }

  if (filters?.invoiceId) {
    where.invoiceId = filters.invoiceId
  }

  const reminders = await prisma.invoiceReminder.findMany({
    where,
    include: {
      invoice: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: {
      sentAt: "desc",
    },
  })

  // Extract outbox entries from reminders
  // Outbox ID is stored in emailSubject as [Outbox: <id>]
  const outboxEntries = reminders
    .map((reminder) => {
      // Extract outbox ID from subject if present
      const outboxIdMatch = reminder.emailSubject?.match(/\[Outbox: ([^\]]+)\]/)
      const outboxId = outboxIdMatch ? outboxIdMatch[1] : `outbox-${reminder.id}-${reminder.sentAt?.getTime() || Date.now()}`

      return {
        id: outboxId,
        reminderId: reminder.id,
        invoiceId: reminder.invoiceId,
        invoiceNumber: reminder.invoice.invoiceNumber,
        customerEmail: reminder.invoice.customer.email,
        customerName: reminder.invoice.customer.name,
        template: reminder.reminderType,
        subject: reminder.emailSubject?.replace(/ \[Outbox: [^\]]+\]/, "") || "", // Remove outbox ID from subject
        body: reminder.emailBody || "",
        status: reminder.status === ReminderStatus.SENT ? "SENT" : "PENDING",
        sentAt: reminder.sentAt,
        createdAt: reminder.createdAt,
      }
    })
    .filter((entry) => entry !== null)

  // Apply status filter if provided
  if (filters?.status) {
    return outboxEntries.filter((entry) => entry?.status === filters.status)
  }

  return outboxEntries
}

/**
 * Get email template with placeholders
 */
function getEmailTemplate(type: ReminderType): { subject: string; body: string; placeholders: string[] } {
  const placeholders = [
    "{{company.name}}",
    "{{company.email}}",
    "{{customer.name}}",
    "{{customer.email}}",
    "{{invoice.number}}",
    "{{invoice.date}}",
    "{{invoice.dueDate}}",
    "{{invoice.amount}}",
    "{{invoice.currency}}",
    "{{invoice.total}}",
    "{{invoice.balance}}",
    "{{daysOverdue}}",
    "{{daysUntilDue}}",
  ]

  const templates = {
    FIRST: {
      subject: "Payment Reminder: Invoice {{invoice.number}}",
      body: `Dear {{customer.name}},

This is a friendly reminder that invoice {{invoice.number}} for {{invoice.amount}} {{invoice.currency}} is due on {{invoice.dueDate}}.

Please ensure payment is made by the due date.

Thank you,
{{company.name}}`,
    },
    SECOND: {
      subject: "Second Reminder: Invoice {{invoice.number}} is Due",
      body: `Dear {{customer.name}},

This is a second reminder that invoice {{invoice.number}} for {{invoice.amount}} {{invoice.currency}} was due on {{invoice.dueDate}}.

Please arrange payment as soon as possible.

Thank you,
{{company.name}}`,
    },
    FINAL: {
      subject: "Final Notice: Invoice {{invoice.number}} is Overdue",
      body: `Dear {{customer.name}},

This is a final notice that invoice {{invoice.number}} for {{invoice.amount}} {{invoice.currency}} is now {{daysOverdue}} days overdue.

Please arrange immediate payment to avoid further action.

Thank you,
{{company.name}}`,
    },
    CUSTOM: {
      subject: "Payment Reminder: Invoice {{invoice.number}}",
      body: `Dear {{customer.name}},

This is a reminder regarding invoice {{invoice.number}} for {{invoice.amount}} {{invoice.currency}}.

{{invoice.dueDate}}

Thank you,
{{company.name}}`,
    },
  }

  return {
    ...templates[type],
    placeholders,
  }
}

export const invoiceRemindersRouter = createTRPCRouter({
  /**
   * Get all reminders with pagination and filters
   */
  getAll: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(reminderListSchema)
    .query(async ({ ctx, input }) => {
      const {
        page,
        limit,
        invoiceId,
        reminderType,
        status,
        scheduledFrom,
        scheduledTo,
        sortBy,
        sortOrder,
      } = input

      // Build where clause
      const where: any = {
        organizationId: ctx.organizationId,
      }

      // Filters
      if (invoiceId) {
        where.invoiceId = invoiceId
      }

      if (reminderType) {
        where.reminderType = reminderType
      }

      if (status) {
        where.status = status
      }

      // Date range filter
      if (scheduledFrom || scheduledTo) {
        where.scheduledFor = {}
        if (scheduledFrom) {
          const from = typeof scheduledFrom === "string" ? new Date(scheduledFrom) : scheduledFrom
          where.scheduledFor.gte = from
        }
        if (scheduledTo) {
          const to = typeof scheduledTo === "string" ? new Date(scheduledTo) : scheduledTo
          to.setHours(23, 59, 59, 999)
          where.scheduledFor.lte = to
        }
      }

      // Determine sort
      const orderBy: any = {}
      if (sortBy) {
        orderBy[sortBy] = sortOrder || "desc"
      } else {
        orderBy.scheduledFor = "desc"
      }

      // Execute paginated query
      const [reminders, total] = await Promise.all([
        prisma.invoiceReminder.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                currency: true,
                dueDate: true,
                customer: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        }),
        prisma.invoiceReminder.count({ where }),
      ])

      return {
        reminders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    }),

  /**
   * Get outstanding invoices for reminders
   * 
   * Returns invoices that need reminders based on rules:
   * - Status not PAID/CANCELLED
   * - Due before/within X days
   * - Exclude already reminded within cool-down
   */
  getOutstandingInvoices: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      daysBeforeDue: z.number().default(0), // Days before due date to remind
      daysOverdue: z.number().default(365), // Maximum days overdue to include
      cooldownDays: z.number().default(7), // Cool-down period in days
    }))
    .query(async ({ ctx, input }) => {
      const outstandingInvoices = await getOutstandingInvoices(ctx.organizationId, {
        daysBeforeDue: input.daysBeforeDue,
        daysOverdue: input.daysOverdue,
        cooldownDays: input.cooldownDays,
      })

      return outstandingInvoices
    }),

  /**
   * Create/schedule a reminder
   */
  create: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      organizationId: z.string().min(1),
      invoiceId: z.string().min(1),
      reminderType: z.enum(["FIRST", "SECOND", "FINAL", "CUSTOM"]),
      scheduledFor: z.date(),
      emailSubject: z.string().optional(),
      emailBody: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify invoice exists and belongs to organization
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        include: {
          customer: true,
        },
      })

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        })
      }

      // Cannot create reminder for paid or cancelled invoices
      if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot create reminder for invoice with status ${invoice.status}`,
        })
      }

      // Get template if not provided
      const template = getEmailTemplate(input.reminderType)
      const emailSubject = input.emailSubject || template.subject
      const emailBody = input.emailBody || template.body

      // Create reminder
      const reminder = await prisma.invoiceReminder.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: input.invoiceId,
          reminderType: input.reminderType as ReminderType,
          scheduledFor: typeof input.scheduledFor === "string" 
            ? new Date(input.scheduledFor) 
            : input.scheduledFor,
          emailSubject,
          emailBody,
          status: ReminderStatus.PENDING,
        },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "invoiceReminder",
        entityId: reminder.id,
        action: "create",
        after: reminder,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          invoiceId: input.invoiceId,
          reminderType: input.reminderType,
          scheduledFor: reminder.scheduledFor.toISOString(),
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, reminderId: reminder.id })
      })

      return reminder
    }),

  /**
   * Send a single reminder
   * 
   * Creates email outbox entry and marks reminder as sent
   */
  sendReminder: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      id: z.string().min(1, "ID is required"),
      organizationId: z.string().min(1, "Organization ID is required"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify resource ownership
      await verifyResourceOwnership("invoiceReminder", input.id, ctx.organizationId)

      // Get reminder with invoice
      const reminder = await prisma.invoiceReminder.findUnique({
        where: {
          id: input.id,
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

      // Cannot send if already sent or cancelled
      if (reminder.status === ReminderStatus.SENT) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Reminder has already been sent",
        })
      }

      if (reminder.status === ReminderStatus.CANCELLED) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot send a cancelled reminder",
        })
      }

      // Get organization for template placeholders
      const organization = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
      })

      // Prepare template payload
      const payload = {
        company: {
          name: organization?.name || "Company",
          email: organization?.email || "",
        },
        customer: {
          name: reminder.invoice.customer.name,
          email: reminder.invoice.customer.email || "",
        },
        invoice: {
          number: reminder.invoice.invoiceNumber,
          date: reminder.invoice.date.toISOString().split("T")[0],
          dueDate: reminder.invoice.dueDate.toISOString().split("T")[0],
          amount: reminder.invoice.total.toNumber(),
          currency: reminder.invoice.currency,
          total: reminder.invoice.total.toNumber(),
        },
        daysOverdue: Math.max(0, Math.ceil(
          (new Date().getTime() - reminder.invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )),
        daysUntilDue: Math.ceil(
          (reminder.invoice.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        ),
      }

      // Create email outbox entry
      const outboxEntry = await createEmailOutboxEntry(
        reminder.id,
        reminder.invoice,
        reminder.reminderType,
        payload
      )

      // Update reminder status and mark as sent
      // Store original email body and outbox entry reference
      // In production, outbox entries would be in a separate table
      const originalBody = reminder.emailBody || ""
      const updatedReminder = await prisma.invoiceReminder.update({
        where: { id: input.id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          // Store outbox entry reference (temporary - would use EmailOutbox table in production)
          emailBody: originalBody, // Keep original body
          emailSubject: `${reminder.emailSubject || ""} [Outbox: ${outboxEntry.id}]`, // Append outbox ID to subject for tracking
        },
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
        },
      })

      // Record audit
      await recordAudit({
        entity: "invoiceReminder",
        entityId: input.id,
        action: "send",
        before: reminder,
        after: updatedReminder,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          outboxEntryId: outboxEntry.id,
          invoiceId: reminder.invoiceId,
        },
      }).catch((error) => {
        console.warn("Audit recording failed", { error, reminderId: input.id })
      })

      return {
        reminder: updatedReminder,
        outboxEntry,
      }
    }),

  /**
   * Send bulk reminders
   * 
   * Batch processes all due reminders per schedule
   */
  sendBulkReminders: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      organizationId: z.string().min(1),
      reminderType: z.enum(["FIRST", "SECOND", "FINAL", "CUSTOM"]).optional(),
      maxReminders: z.number().default(100), // Limit batch size
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()

      // Get pending reminders that are due
      const where: any = {
        organizationId: ctx.organizationId,
        status: ReminderStatus.PENDING,
        scheduledFor: {
          lte: now, // Due on or before now
        },
      }

      if (input.reminderType) {
        where.reminderType = input.reminderType
      }

      const pendingReminders = await prisma.invoiceReminder.findMany({
        where,
        include: {
          invoice: {
            include: {
              customer: true,
            },
          },
        },
        take: input.maxReminders,
        orderBy: {
          scheduledFor: "asc",
        },
      })

      const results = {
        total: pendingReminders.length,
        sent: 0,
        failed: 0,
        reminders: [] as any[],
        outboxEntries: [] as any[],
      }

      // Throttle: Process reminders with delay between batches
      const throttleDelay = 1000 // 1 second between batches
      const batchSize = 10 // Process 10 reminders at a time

      // Process reminders in batches with throttling
      for (let i = 0; i < pendingReminders.length; i += batchSize) {
        const batch = pendingReminders.slice(i, i + batchSize)

        // Process batch
        await Promise.all(
          batch.map(async (reminder) => {
            try {
              // Get organization
              const organization = await prisma.organization.findUnique({
                where: { id: ctx.organizationId },
              })

              // Get customer email
              const customerEmail = reminder.invoice.customer.email
              if (!customerEmail) {
                throw new Error(`Customer ${reminder.invoice.customer.name} has no email address`)
              }

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
                throw new Error("Reminder template not found")
              }

              // Use custom subject/body if provided, otherwise use template
              const subject = reminder.emailSubject || renderTemplate(template.subject, templateVars)
              const htmlBody = reminder.emailBody || renderTemplate(template.html, templateVars)
              const textBody = template.text ? renderTemplate(template.text, templateVars) : undefined

              // Send email via email service
              const outboxEntry = await createAndSendEmail({
                organizationId: ctx.organizationId,
                userId: ctx.session.user.id,
                entityType: "reminder",
                entityId: reminder.id,
                to: [customerEmail],
                subject,
                html: htmlBody,
                text: textBody,
                template: "reminder",
                templateVars,
              })

              // Update reminder with email status
              const updatedReminder = await prisma.invoiceReminder.update({
                where: { id: reminder.id },
                data: {
                  status: ReminderStatus.SENT,
                  sentAt: new Date(),
                  emailSubject: subject,
                  emailBody: htmlBody,
                  metadata: {
                    ...((reminder.metadata as any) || {}),
                    emailOutboxId: outboxEntry.id,
                    messageId: outboxEntry.messageId,
                  },
                },
              })

              // Record audit
              await recordAudit({
                entity: "invoiceReminder",
                entityId: reminder.id,
                action: "send",
                before: reminder,
                after: updatedReminder,
                organizationId: ctx.organizationId,
                userId: ctx.session.user.id,
                meta: {
                  emailOutboxId: outboxEntry.id,
                  messageId: outboxEntry.messageId,
                  invoiceId: reminder.invoiceId,
                },
              }).catch((error) => {
                console.warn("Audit recording failed", { error, reminderId: reminder.id })
              })

              results.sent++
              results.reminders.push(updatedReminder)
              results.outboxEntries.push(outboxEntry)
            } catch (error) {
              // Mark as failed
              await prisma.invoiceReminder.update({
                where: { id: reminder.id },
                data: {
                  status: ReminderStatus.FAILED,
                  metadata: {
                    ...((reminder.metadata as any) || {}),
                    error: error instanceof Error ? error.message : "Unknown error",
                    failedAt: new Date().toISOString(),
                  },
                },
              })

              results.failed++
            }
          })
        )

        // Throttle: Wait before processing next batch (except for last batch)
        if (i + batchSize < pendingReminders.length) {
          await new Promise((resolve) => setTimeout(resolve, throttleDelay))
        }
      }

      // Record audit
      await recordAudit({
        entity: "invoiceReminder",
        entityId: "bulk",
        action: "sendBulk",
        after: results,
        organizationId: ctx.organizationId,
        userId: ctx.session.user.id,
        meta: {
          total: results.total,
          sent: results.sent,
          failed: results.failed,
        },
        details: `Bulk sent ${results.sent} reminders, ${results.failed} failed`,
      }).catch((error) => {
        console.warn("Audit recording failed", { error })
      })

      return results
    }),

  /**
   * Get reminder scheduler status
   * 
   * Returns last run, next run, and failure counts
   */
  getSchedulerStatus: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const { getSchedulerStatus } = await import("@/lib/jobs/reminder-scheduler")
      return getSchedulerStatus(input.organizationId)
    }),

  /**
   * Manually trigger reminder processing
   * 
   * Processes pending reminders for the organization
   */
  processReminders: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_SEND))
    .input(z.object({
      organizationId: z.string().min(1),
      maxReminders: z.number().default(100).optional(),
      throttleDelay: z.number().default(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { processRemindersForOrganization } = await import("@/lib/jobs/reminder-scheduler")
      return processRemindersForOrganization(
        ctx.organizationId,
        input.maxReminders,
        input.throttleDelay
      )
    }),

  /**
   * Get email templates
   * 
   * Returns templates with placeholders for different reminder types
   */
  getTemplates: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      reminderType: z.enum(["FIRST", "SECOND", "FINAL", "CUSTOM"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (input.reminderType) {
        // Return single template
        const template = getEmailTemplate(input.reminderType)
        return {
          type: input.reminderType,
          ...template,
        }
      }

      // Return all templates
      const templates = {
        FIRST: getEmailTemplate(ReminderType.FIRST),
        SECOND: getEmailTemplate(ReminderType.SECOND),
        FINAL: getEmailTemplate(ReminderType.FINAL),
        CUSTOM: getEmailTemplate(ReminderType.CUSTOM),
      }

      return {
        templates,
        placeholders: [
          "{{company.name}}",
          "{{company.email}}",
          "{{customer.name}}",
          "{{customer.email}}",
          "{{invoice.number}}",
          "{{invoice.date}}",
          "{{invoice.dueDate}}",
          "{{invoice.amount}}",
          "{{invoice.currency}}",
          "{{invoice.total}}",
          "{{daysOverdue}}",
          "{{daysUntilDue}}",
        ],
      }
    }),

  /**
   * Get outbox entries
   * 
   * Returns all email outbox entries for viewing/simulation
   */
  getOutboxEntries: orgScopedProcedure
    .use(requirePermissionProcedure(Permission.INVOICES_VIEW))
    .input(z.object({
      organizationId: z.string().min(1),
      status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
      invoiceId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const outboxEntries = await getOutboxEntries(ctx.organizationId, {
        status: input.status,
        invoiceId: input.invoiceId,
      })

      return {
        entries: outboxEntries,
        total: outboxEntries.length,
      }
    }),
})

