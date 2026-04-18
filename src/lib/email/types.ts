/**
 * Email Service Types
 */

export type EmailProvider = 'sendgrid' | 'ses' | 'mailgun' | 'smtp' | 'sandbox'

export interface EmailConfig {
  provider: EmailProvider
  fromAddress: string
  fromName?: string
  replyTo?: string
  domain?: string
  sandboxMode?: boolean
  
  // SendGrid config
  sendgrid?: {
    apiKey: string
  }
  
  // AWS SES config
  ses?: {
    region: string
    accessKeyId: string
    secretAccessKey: string
  }
  
  // Mailgun config
  mailgun?: {
    apiKey: string
    domain: string
  }
  
  // SMTP config
  smtp?: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
  contentId?: string
}

export interface SendEmailOptions {
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  html?: string
  text?: string
  attachments?: EmailAttachment[]
  replyTo?: string
  metadata?: Record<string, any>
}

export interface SendEmailResult {
  messageId: string
  provider: string
  status: 'sent' | 'queued' | 'failed'
  error?: string
}

export interface EmailTemplate {
  name: string
  subject: string
  html: string
  text?: string
  variables: string[] // List of available variables
  version: number
}




