/**
 * Sandbox Email Driver
 * 
 * For testing - logs emails instead of sending
 */

import { EmailDriver, EmailConfig, SendEmailOptions, SendEmailResult } from '../types'

export class SandboxEmailDriver implements EmailDriver {
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    // In sandbox mode, just log the email
    const messageId = `sandbox-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    console.log('[Email Sandbox] Email would be sent:', {
      messageId,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      hasHtml: !!options.html,
      hasText: !!options.text,
      attachmentCount: options.attachments?.length || 0,
    })

    // In production, you might want to store this in a test database
    // or write to a file for inspection

    return {
      messageId,
      provider: 'sandbox',
      status: 'sent',
    }
  }
}




