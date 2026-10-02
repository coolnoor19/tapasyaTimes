import { escapeHtml, renderCodeBox, renderLayout } from "../layout.js"

interface VerifyEmailParams {
    firstName: string
    code: string
    expiresInMinutes: number
}

// Every template returns subject + html + text, so adding a new email means
// adding one file like this one. Never put the code in the subject line: it
// would show on lock screens and in notification previews.
export function verifyEmailTemplate({ firstName, code, expiresInMinutes }: VerifyEmailParams) {
    const subject = "Verify your email for Tapasya Times"

    const html = renderLayout({
        preheader: `Your verification code is valid for ${expiresInMinutes} minutes`,
        bodyHtml: `
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>Use this code to verify your email address:</p>
          ${renderCodeBox(code)}
          <p>The code expires in ${expiresInMinutes} minutes. If you did not create an account, you can ignore this email.</p>
          <p><strong>Never share this code with anyone.</strong> Tapasya Times staff will never ask for it.</p>`,
    })

    const text = [
        `Hi ${firstName},`,
        "",
        "Use this code to verify your email address:",
        "",
        code,
        "",
        `The code expires in ${expiresInMinutes} minutes. If you did not create an account, you can ignore this email.`,
        "Never share this code with anyone. Tapasya Times staff will never ask for it.",
    ].join("\n")

    return { subject, html, text }
}
