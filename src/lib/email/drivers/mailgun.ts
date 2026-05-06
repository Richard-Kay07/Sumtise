import FormData from "form-data"
import Mailgun from "mailgun.js"
import type { EmailDriver, EmailConfig, SendEmailOptions, SendEmailResult } from "../types"

export class MailgunEmailDriver implements EmailDriver {
  private readonly config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { apiKey, domain } = this.config.mailgun ?? {}
    if (!apiKey || !domain) {
      throw new Error(
        "Mailgun credentials not configured (set MAILGUN_API_KEY, MAILGUN_DOMAIN)"
      )
    }

    const mg     = new Mailgun(FormData)
    const client = mg.client({ username: "api", key: apiKey })

    const messageData: Record<string, unknown> = {
      from:    `${this.config.fromName} <${this.config.fromAddress}>`,
      to:      options.to,
      subject: options.subject,
    }

    if (options.cc?.length)  messageData.cc  = options.cc
    if (options.bcc?.length) messageData.bcc = options.bcc
    if (options.text)        messageData.text = options.text
    if (options.html)        messageData.html = options.html

    const replyTo = options.replyTo ?? this.config.replyTo
    if (replyTo) messageData["h:Reply-To"] = replyTo

    if (options.attachments?.length) {
      messageData.attachment = options.attachments.map((att) => ({
        filename: att.filename,
        data:     Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
      }))
    }

    const response = await client.messages.create(domain, messageData as any)

    return {
      messageId: (response as any).id ?? "",
      provider:  "mailgun",
      status:    "sent",
    }
  }
}
