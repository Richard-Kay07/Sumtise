import { SESClient } from "@aws-sdk/client-ses"
import { SendRawEmailCommand } from "@aws-sdk/client-ses"
import nodemailer from "nodemailer"
import type { EmailDriver, EmailConfig, SendEmailOptions, SendEmailResult } from "../types"

export class SESEmailDriver implements EmailDriver {
  private readonly config: EmailConfig

  constructor(config: EmailConfig) {
    this.config = config
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    const { accessKeyId, secretAccessKey, region } = this.config.ses ?? {}
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS SES credentials not configured (set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
      )
    }

    const ses = new SESClient({
      region: region ?? "us-east-1",
      credentials: { accessKeyId, secretAccessKey },
    })

    // Use nodemailer's SES transport so attachments and MIME are handled automatically
    const transporter = nodemailer.createTransport({
      SES: { ses, aws: { SendRawEmailCommand } },
    })

    const info = await transporter.sendMail({
      from:    `${this.config.fromName} <${this.config.fromAddress}>`,
      to:      options.to,
      cc:      options.cc,
      bcc:     options.bcc,
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
      provider:  "ses",
      status:    "sent",
    }
  }
}
