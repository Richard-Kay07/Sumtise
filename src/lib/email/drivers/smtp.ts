import nodemailer from "nodemailer"
import type { EmailDriver, EmailConfig, SendEmailOptions, SendEmailResult } from "../types"

export class SMTPEmailDriver implements EmailDriver {
  private readonly config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const smtp = this.config.smtp
    if (!smtp?.host || !smtp?.auth?.user) {
      throw new Error(
        "SMTP configuration incomplete (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD)"
      )
    }

    const transporter = nodemailer.createTransport({
      host:   smtp.host,
      port:   smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.auth.user,
        pass: smtp.auth.pass,
      },
    })

    const info = await transporter.sendMail({
      from:    `${this.config.fromName} <${this.config.fromAddress}>`,
      to:      options.to.join(", "),
      cc:      options.cc?.join(", "),
      bcc:     options.bcc?.join(", "),
      replyTo: options.replyTo ?? this.config.replyTo,
      subject: options.subject,
      text:    options.text,
      html:    options.html,
      attachments: options.attachments?.map((att) => ({
        filename:    att.filename,
        content:     att.content,
        contentType: att.contentType,
        cid:         att.contentId,
      })),
    })

    return {
      messageId: info.messageId ?? "",
      provider:  "smtp",
      status:    "sent",
    }
  }
}
