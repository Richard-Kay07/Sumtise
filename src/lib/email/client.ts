/**
 * Email Service Client
 * 
 * Unified email sending interface supporting:
 * - SendGrid
 * - AWS SES
 * - Mailgun
 * - SMTP
 * - Sandbox mode (for testing)
 * 
 * Features:
 * - Template rendering
 * - Attachment support
 * - Retry logic
 * - Delivery tracking
 */

import { EmailProvider, EmailConfig, SendEmailOptions, SendEmailResult, EmailAttachment } from './types'
import { SendGridEmailDriver } from './drivers/sendgrid'
import { SESEmailDriver } from './drivers/ses'
import { MailgunEmailDriver } from './drivers/mailgun'
import { SMTPEmailDriver } from './drivers/smtp'
import { SandboxEmailDriver } from './drivers/sandbox'

export interface EmailDriver {
  send(options: SendEmailOptions): Promise<SendEmailResult>
}

export class EmailService {
  private driver: EmailDriver
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
    
    // Initialize driver based on provider
    switch (config.provider) {
      case 'sendgrid':
        this.driver = new SendGridEmailDriver(config)
        break
      case 'ses':
        this.driver = new SESEmailDriver(config)
        break
      case 'mailgun':
        this.driver = new MailgunEmailDriver(config)
        break
      case 'smtp':
        this.driver = new SMTPEmailDriver(config)
        break
      case 'sandbox':
      default:
        this.driver = new SandboxEmailDriver(config)
        break
    }
  }

  /**
   * Send email
   * @param options Email options
   * @returns Send result with messageId
   */
  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    // Validate recipients
    if (!options.to || options.to.length === 0) {
      throw new Error('At least one recipient (to) is required')
    }

    // Validate subject
    if (!options.subject || options.subject.trim().length === 0) {
      throw new Error('Email subject is required')
    }

    // Validate body
    if (!options.html && !options.text) {
      throw new Error('Either HTML or text body is required')
    }

    // Set default from address
    const sendOptions: SendEmailOptions = {
      ...options,
      replyTo: options.replyTo || this.config.replyTo || this.config.fromAddress,
    }

    // Send via driver
    try {
      const result = await this.driver.send(sendOptions)
      return result
    } catch (error: any) {
      return {
        messageId: '',
        provider: this.config.provider,
        status: 'failed',
        error: error.message || 'Unknown error',
      }
    }
  }
}

/**
 * Create email service instance from environment variables
 */
export function createEmailService(): EmailService {
  const provider = (process.env.EMAIL_PROVIDER || 'sandbox') as EmailProvider
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com'
  const fromName = process.env.EMAIL_FROM_NAME || 'Sumtise'
  const sandboxMode = process.env.EMAIL_SANDBOX_MODE === 'true' || provider === 'sandbox'

  const config: EmailConfig = {
    provider,
    fromAddress,
    fromName,
    replyTo: process.env.EMAIL_REPLY_TO,
    domain: process.env.EMAIL_DOMAIN,
    sandboxMode,
    
    // SendGrid config
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
    },
    
    // AWS SES config
    ses: {
      region: process.env.AWS_SES_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    
    // Mailgun config
    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY || '',
      domain: process.env.MAILGUN_DOMAIN || '',
    },
    
    // SMTP config
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
      },
    },
  }

  return new EmailService(config)
}

// Export singleton instance
export const emailService = createEmailService()




