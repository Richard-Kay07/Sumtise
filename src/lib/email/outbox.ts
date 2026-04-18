/**
 * Email Outbox Service
 * 
 * Manages email outbox entries, retries, and delivery status
 */

import { prisma } from '@/lib/prisma'
import { EmailStatus } from '@prisma/client'
import { emailService, SendEmailOptions } from './client'
import { renderTemplate, getTemplate } from './templates'

export interface CreateOutboxEntryOptions {
  organizationId: string
  userId?: string
  entityType: 'invoice' | 'reminder' | 'payment'
  entityId?: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  html?: string
  text?: string
  template?: string
  templateVars?: Record<string, any>
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  metadata?: Record<string, any>
}

/**
 * Create email outbox entry and send
 */
export async function createAndSendEmail(options: CreateOutboxEntryOptions) {
  const {
    organizationId,
    userId,
    entityType,
    entityId,
    to,
    cc,
    bcc,
    subject,
    html,
    text,
    template,
    templateVars,
    attachments,
    metadata,
  } = options

  // Render template if provided
  let finalHtml = html
  let finalText = text

  if (template && templateVars) {
    const emailTemplate = getTemplate(template)
    if (emailTemplate) {
      finalHtml = renderTemplate(emailTemplate.html, templateVars)
      finalText = emailTemplate.text ? renderTemplate(emailTemplate.text, templateVars) : text
    }
  }

  // Create outbox entry
  const outboxEntry = await prisma.emailOutbox.create({
    data: {
      organizationId,
      userId,
      entityType,
      entityId,
      to,
      cc: cc || [],
      bcc: bcc || [],
      subject,
      htmlBody: finalHtml,
      textBody: finalText,
      template: template || null,
      templateVars: templateVars ? JSON.parse(JSON.stringify(templateVars)) : null,
      attachments: attachments
        ? JSON.parse(JSON.stringify(attachments.map((att) => ({
            filename: att.filename,
            contentType: att.contentType,
            // Store reference only, not actual content
          }))))
        : null,
      status: EmailStatus.PENDING,
      maxRetries: 3,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    },
  })

  // Send email
  try {
    const sendOptions: SendEmailOptions = {
      to,
      cc,
      bcc,
      subject,
      html: finalHtml,
      text: finalText,
      attachments: attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
      metadata,
    }

    const result = await emailService.send(sendOptions)

    // Update outbox entry with result
    await prisma.emailOutbox.update({
      where: { id: outboxEntry.id },
      data: {
        messageId: result.messageId,
        provider: result.provider,
        status: result.status === 'sent' ? EmailStatus.SENT : EmailStatus.FAILED,
        sentAt: result.status === 'sent' ? new Date() : null,
        error: result.error || null,
      },
    })

    return {
      ...outboxEntry,
      messageId: result.messageId,
      status: result.status === 'sent' ? EmailStatus.SENT : EmailStatus.FAILED,
    }
  } catch (error: any) {
    // Update outbox entry with error
    await prisma.emailOutbox.update({
      where: { id: outboxEntry.id },
      data: {
        status: EmailStatus.FAILED,
        error: error.message || 'Unknown error',
        retryCount: 1,
      },
    })

    throw error
  }
}

/**
 * Retry failed email
 */
export async function retryEmail(outboxId: string) {
  const outboxEntry = await prisma.emailOutbox.findUnique({
    where: { id: outboxId },
  })

  if (!outboxEntry) {
    throw new Error('Outbox entry not found')
  }

  if (outboxEntry.retryCount >= outboxEntry.maxRetries) {
    throw new Error('Maximum retry count exceeded')
  }

  if (outboxEntry.status === EmailStatus.SENT) {
    throw new Error('Email already sent')
  }

  try {
    const sendOptions: SendEmailOptions = {
      to: outboxEntry.to,
      cc: outboxEntry.cc,
      bcc: outboxEntry.bcc,
      subject: outboxEntry.subject,
      html: outboxEntry.htmlBody || undefined,
      text: outboxEntry.textBody || undefined,
    }

    const result = await emailService.send(sendOptions)

    // Update outbox entry
    await prisma.emailOutbox.update({
      where: { id: outboxId },
      data: {
        messageId: result.messageId,
        provider: result.provider,
        status: result.status === 'sent' ? EmailStatus.SENT : EmailStatus.FAILED,
        sentAt: result.status === 'sent' ? new Date() : null,
        error: result.error || null,
        retryCount: outboxEntry.retryCount + 1,
      },
    })

    return {
      ...outboxEntry,
      messageId: result.messageId,
      status: result.status === 'sent' ? EmailStatus.SENT : EmailStatus.FAILED,
      retryCount: outboxEntry.retryCount + 1,
    }
  } catch (error: any) {
    // Update outbox entry with error
    await prisma.emailOutbox.update({
      where: { id: outboxId },
      data: {
        status: EmailStatus.FAILED,
        error: error.message || 'Unknown error',
        retryCount: outboxEntry.retryCount + 1,
      },
    })

    throw error
  }
}

/**
 * Process pending emails (for background job)
 */
export async function processPendingEmails(limit: number = 10) {
  const pendingEmails = await prisma.emailOutbox.findMany({
    where: {
      status: EmailStatus.PENDING,
      retryCount: { lt: prisma.emailOutbox.fields.maxRetries },
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
  })

  const results = []

  for (const email of pendingEmails) {
    try {
      await retryEmail(email.id)
      results.push({ id: email.id, status: 'success' })
    } catch (error: any) {
      results.push({ id: email.id, status: 'failed', error: error.message })
    }
  }

  return results
}




