import nodemailer from "nodemailer"
import { env } from "../config/env.js"
import { logger } from "../utils/logger.js"

export interface MailMessage {
    to: string
    subject: string
    html: string
    text: string
}

const transporter = env.SMTP_HOST
    ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          // 465 uses implicit TLS; 587 starts plain and upgrades with STARTTLS.
          secure: env.SMTP_PORT === 465,
          ...(env.SMTP_USER && env.SMTP_PASS ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
          // Do not let a slow mail server hang a request or job forever.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
      })
    : null

const from = env.MAIL_FROM ?? (env.SMTP_USER ? `Tapasya Times <${env.SMTP_USER}>` : "Tapasya Times <no-reply@localhost>")

export async function sendMail(message: MailMessage): Promise<void> {
    if (!transporter) {
        // Development only: production requires SMTP (see config/env.ts).
        logger.info({ to: message.to, subject: message.subject, text: message.text }, "SMTP not configured, email printed instead of sent")
        return
    }
    await transporter.sendMail({ from, ...message })
}
