/**
 * Reminder Scheduler
 * 
 * Handles automated reminder email execution with:
 * - Job queue processing
 * - Locking to avoid double sends
 * - Rate limiting per organization
 * - Cool-down period enforcement
 * - Failure retry logic
 */

import { prisma } from '@/lib/prisma'
import { ReminderStatus } from '@prisma/client'
import { createAndSendEmail } from '@/lib/email/outbox'
import { getTemplate, renderTemplate } from '@/lib/email/templates'
import { recordAudit } from '@/lib/audit'

/**
 * Lock key for reminder processing
 * Prevents concurrent execution
 */
const LOCK_KEY = 'reminder-scheduler-lock'
const LOCK_TTL = 300000 // 5 minutes

/**
 * In-memory lock (in production, use Redis or database)
 */
let lockHolder: string | null = null
let lockExpiry: number = 0

/**
 * Acquire lock for reminder processing
 */
function acquireLock(workerId: string): boolean {
  const now = Date.now()
  
  // Check if lock is held and not expired
  if (lockHolder && lockExpiry > now) {
    return false
  }
  
  // Acquire lock
  lockHolder = workerId
  lockExpiry = now + LOCK_TTL
  return true
}

/**
 * Release lock
 */
function releaseLock(workerId: string): void {
  if (lockHolder === workerId) {
    lockHolder = null
    lockExpiry = 0
  }
}

/**
 * Process pending reminders for an organization
 * 
 * @param organizationId Organization ID
 * @param maxReminders Maximum reminders to process
 * @param throttleDelay Delay between batches (ms)
 * @returns Processing results
 */
export async function processRemindersForOrganization(
  organizationId: string,
  maxReminders: number = 100,
  throttleDelay: number = 1000
): Promise<{
  total: number
  sent: number
  failed: number
  skipped: number
  messageIds: string[]
}> {
  const now = new Date()
  const results = {
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    messageIds: [] as string[],
  }

  // Get pending reminders that are due
  const pendingReminders = await prisma.invoiceReminder.findMany({
    where: {
      organizationId,
      status: ReminderStatus.PENDING,
      scheduledFor: {
        lte: now,
      },
    },
    include: {
      invoice: {
        include: {
          customer: true,
        },
      },
    },
    take: maxReminders,
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  results.total = pendingReminders.length

  // Process reminders in batches
  const batchSize = 10
  for (let i = 0; i < pendingReminders.length; i += batchSize) {
    const batch = pendingReminders.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (reminder) => {
        try {
          // Check cool-down period (7 days default)
          const cooldownDays = 7
          const cooldownThreshold = new Date(now)
          cooldownThreshold.setDate(cooldownThreshold.getDate() - cooldownDays)

          // Check if invoice was recently reminded
          const recentReminder = await prisma.invoiceReminder.findFirst({
            where: {
              invoiceId: reminder.invoiceId,
              status: ReminderStatus.SENT,
              sentAt: {
                gte: cooldownThreshold,
              },
            },
            orderBy: {
              sentAt: 'desc',
            },
          })

          if (recentReminder && recentReminder.id !== reminder.id) {
            // Skip - within cool-down period
            results.skipped++
            return
          }

          // Get organization
          const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
          })

          // Get customer email
          const customerEmail = reminder.invoice.customer.email
          if (!customerEmail) {
            throw new Error(`Customer ${reminder.invoice.customer.name} has no email address`)
          }

          // Calculate days overdue
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
            balance: reminder.invoice.total.toNumber(),
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
            organizationId,
            userId: null, // System user
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
          await prisma.invoiceReminder.update({
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
                processedAt: new Date().toISOString(),
              },
            },
          })

          // Record audit
          await recordAudit({
            entity: "invoiceReminder",
            entityId: reminder.id,
            action: "send",
            after: {
              status: ReminderStatus.SENT,
              sentAt: new Date(),
            },
            organizationId,
            userId: null, // System user
            meta: {
              emailOutboxId: outboxEntry.id,
              messageId: outboxEntry.messageId,
              invoiceId: reminder.invoiceId,
              automated: true,
            },
          }).catch((error) => {
            console.warn("Audit recording failed", { error, reminderId: reminder.id })
          })

          results.sent++
          results.messageIds.push(outboxEntry.messageId || '')
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
                retryCount: ((reminder.metadata as any)?.retryCount || 0) + 1,
              },
            },
          })

          results.failed++
        }
      })
    )

    // Throttle: Wait before processing next batch
    if (i + batchSize < pendingReminders.length) {
      await new Promise((resolve) => setTimeout(resolve, throttleDelay))
    }
  }

  return results
}

/**
 * Process reminders for all organizations
 * 
 * @param maxRemindersPerOrg Maximum reminders per organization
 * @param throttleDelay Delay between batches (ms)
 * @returns Processing results
 */
export async function processAllReminders(
  maxRemindersPerOrg: number = 100,
  throttleDelay: number = 1000
): Promise<{
  organizations: number
  total: number
  sent: number
  failed: number
  skipped: number
}> {
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).substring(7)}`

  // Acquire lock
  if (!acquireLock(workerId)) {
    throw new Error("Another reminder processor is already running")
  }

  try {
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: { id: true },
    })

    const results = {
      organizations: organizations.length,
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
    }

    // Process reminders for each organization
    for (const org of organizations) {
      try {
        const orgResults = await processRemindersForOrganization(
          org.id,
          maxRemindersPerOrg,
          throttleDelay
        )

        results.total += orgResults.total
        results.sent += orgResults.sent
        results.failed += orgResults.failed
        results.skipped += orgResults.skipped
      } catch (error) {
        console.error(`Failed to process reminders for organization ${org.id}:`, error)
      }
    }

    return results
  } finally {
    // Release lock
    releaseLock(workerId)
  }
}

/**
 * Get scheduler status
 * 
 * Returns last run time, next run time, and failure counts
 */
export async function getSchedulerStatus(organizationId?: string): Promise<{
  lastRun: Date | null
  nextRun: Date | null
  failures: number
  pending: number
}> {
  const now = new Date()

  // Get last run time (from most recent sent reminder)
  const where: any = {
    status: ReminderStatus.SENT,
  }

  if (organizationId) {
    where.organizationId = organizationId
  }

  const lastSent = await prisma.invoiceReminder.findFirst({
    where,
    orderBy: {
      sentAt: 'desc',
    },
    select: {
      sentAt: true,
    },
  })

  // Get next run time (from earliest pending reminder)
  const nextPending = await prisma.invoiceReminder.findFirst({
    where: {
      ...where,
      status: ReminderStatus.PENDING,
      scheduledFor: {
        gte: now,
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
    select: {
      scheduledFor: true,
    },
  })

  // Get failure count
  const failureCount = await prisma.invoiceReminder.count({
    where: {
      ...where,
      status: ReminderStatus.FAILED,
    },
  })

  // Get pending count
  const pendingCount = await prisma.invoiceReminder.count({
    where: {
      ...where,
      status: ReminderStatus.PENDING,
      scheduledFor: {
        lte: now,
      },
    },
  })

  return {
    lastRun: lastSent?.sentAt || null,
    nextRun: nextPending?.scheduledFor || null,
    failures: failureCount,
    pending: pendingCount,
  }
}




