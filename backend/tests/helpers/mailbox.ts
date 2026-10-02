import type { MailMessage } from "../../src/mail/mailer.js"

// Stand-in for src/mail/mailer.ts in tests. Install it in a test file with:
//   vi.mock("../../src/mail/mailer.js", () => import("../helpers/mailbox.js"))
// Emails are collected here instead of being sent.

export const outbox: MailMessage[] = []

let failNext = false

export async function sendMail(message: MailMessage): Promise<void> {
    if (failNext) {
        failNext = false
        throw new Error("Simulated SMTP failure")
    }
    outbox.push(message)
}

export function clearOutbox() {
    outbox.length = 0
    failNext = false
}

export function failNextMail() {
    failNext = true
}

export function mailsTo(email: string) {
    return outbox.filter((mail) => mail.to === email)
}

// Registration and resend send mail in the background, so wait for it to arrive.
export async function waitForMail(email: string, count = 1, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    while (mailsTo(email).length < count) {
        if (Date.now() > deadline) throw new Error(`No email #${count} to ${email} within ${timeoutMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, 25))
    }
    return mailsTo(email)[count - 1]!
}

// Time for a background send that should NOT happen to prove it did not.
export const settle = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))

export function extractCode(mail: MailMessage): string {
    const match = mail.text.match(/\b(\d{6})\b/)
    if (!match) throw new Error("No 6-digit code found in email")
    return match[1]!
}
