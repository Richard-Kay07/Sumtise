import type { EmailProvider, EmailConfig, SendEmailOptions, SendEmailResult } from "./types"
import { SendGridEmailDriver } from "./drivers/sendgrid"
import { SESEmailDriver }      from "./drivers/ses"
import { MailgunEmailDriver }  from "./drivers/mailgun"
import { SMTPEmailDriver }     from "./drivers/smtp"
import { SandboxEmailDriver }  from "./drivers/sandbox"

export interface EmailDriver {
  send(options: SendEmailOptions): Promise<SendEmailResult>
}

export class EmailService {
  private driver: EmailDriver
  private config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config

    switch (config.provider) {
      case "sendgrid": this.driver = new SendGridEmailDriver(config); break
      case "ses":      this.driver = new SESEmailDriver(config);      break
      case "mailgun":  this.driver = new MailgunEmailDriver(config);  break
      case "smtp":     this.driver = new SMTPEmailDriver(config);     break
      case "sandbox":
      default:         this.driver = new SandboxEmailDriver(config);  break
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!options.to?.length) {
      throw new Error("At least one recipient (to) is required")
    }
    if (!options.subject?.trim()) {
      throw new Error("Email subject is required")
    }
    if (!options.html && !options.text) {
      throw new Error("Either HTML or text body is required")
    }

    const sendOptions: SendEmailOptions = {
      ...options,
      replyTo: options.replyTo ?? this.config.replyTo ?? this.config.fromAddress,
    }

    try {
      return await this.driver.send(sendOptions)
    } catch (error: any) {
      return {
        messageId: "",
        provider:  this.config.provider,
        status:    "failed",
        error:     error.message ?? "Unknown error",
      }
    }
  }

  get provider(): EmailProvider {
    return this.config.provider
  }
}

// ---------------------------------------------------------------------------
// Factory — reads env vars at call time, not at module load time.
// This prevents server crashes when EMAIL_PROVIDER is set but the
// corresponding credentials are not yet configured.
// ---------------------------------------------------------------------------

export function createEmailService(): EmailService {
  const provider     = (process.env.EMAIL_PROVIDER ?? "sandbox") as EmailProvider
  const fromAddress  = process.env.EMAIL_FROM_ADDRESS ?? "noreply@sumtise.app"
  const fromName     = process.env.EMAIL_FROM_NAME    ?? "Sumtise"
  const sandboxMode  = process.env.EMAIL_SANDBOX_MODE === "true" || provider === "sandbox"

  const config: EmailConfig = {
    provider,
    fromAddress,
    fromName,
    replyTo:     process.env.EMAIL_REPLY_TO,
    domain:      process.env.EMAIL_DOMAIN,
    sandboxMode,

    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY ?? "",
    },

    ses: {
      region:          process.env.AWS_SES_REGION        ?? "us-east-1",
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    },

    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY    ?? "",
      domain: process.env.MAILGUN_DOMAIN     ?? "",
    },

    smtp: {
      host:   process.env.SMTP_HOST     ?? "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_SECURE   === "true",
      auth: {
        user: process.env.SMTP_USER     ?? "",
        pass: process.env.SMTP_PASSWORD ?? "",
      },
    },
  }

  return new EmailService(config)
}

// ---------------------------------------------------------------------------
// Lazy singleton — created on first use so module load never crashes.
// Use getEmailService() in application code instead of emailService directly.
// ---------------------------------------------------------------------------

let _instance: EmailService | null = null

export function getEmailService(): EmailService {
  if (!_instance) {
    _instance = createEmailService()
  }
  return _instance
}

// Backward-compatible proxy so existing imports of `emailService` keep working
export const emailService: Pick<EmailService, "send"> = {
  send: (options) => getEmailService().send(options),
}
