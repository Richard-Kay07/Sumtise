import sgMail from "@sendgrid/mail"
import type { EmailDriver, EmailConfig, SendEmailOptions, SendEmailResult } from "../types"

export class SendGridEmailDriver implements EmailDriver {
  private readonly config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
    // Validate at send time, not here — avoids module-load crash when key is absent
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const apiKey = this.config.sendgrid?.apiKey
    if (!apiKey) {
      throw new Error("SendGrid API key not configured (set SENDGRID_API_KEY)")
    }

    sgMail.setApiKey(apiKey)

    const msg = {
      to:      options.to,
      cc:      options.cc,
      bcc:     options.bcc,
      from: {
        email: this.config.fromAddress,
        name:  this.config.fromName,
      },
      replyTo: options.replyTo ?? this.config.replyTo,
      subject: options.subject,
      text:    options.text,
      html:    options.html,
      attachments: options.attachments?.map((att) => ({
        content:     Buffer.isBuffer(att.content)
          ? att.content.toString("base64")
          : Buffer.from(att.content).toString("base64"),
        filename:    att.filename,
        type:        att.contentType,
        contentId:   att.contentId,
        disposition: att.contentId ? ("inline" as const) : ("attachment" as const),
      })),
    }

    const [response] = await sgMail.send(msg as any)

    return {
      messageId: (response.headers?.["x-message-id"] as string) ?? "",
      provider:  "sendgrid",
      status:    "sent",
    }
  }
}
