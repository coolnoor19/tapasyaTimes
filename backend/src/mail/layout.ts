// Shared look for every email. Change the brand here and all templates follow.

const BRAND_NAME = "Tapasya Times"
const COLORS = {
    background: "#f4f5f7",
    card: "#ffffff",
    text: "#1f2933",
    muted: "#6b7280",
    accent: "#2f5d50",
}

// Every value that comes from a user (names, notes...) must pass through this
// before being placed in HTML, otherwise it could inject markup.
export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

interface LayoutOptions {
    // Short text shown in the inbox list next to the subject
    preheader: string
    // Already-safe HTML (build it with escapeHtml for any user value)
    bodyHtml: string
}

export function renderLayout({ preheader, bodyHtml }: LayoutOptions): string {
    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:${COLORS.background};font-family:Arial,Helvetica,sans-serif;color:${COLORS.text};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.background};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${COLORS.card};border-radius:8px;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;font-size:20px;font-weight:bold;color:${COLORS.accent};">${BRAND_NAME}</td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:${COLORS.muted};">
          This is an automated message from ${BRAND_NAME}. Please do not reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Large boxed value, used for one-time codes.
export function renderCodeBox(code: string): string {
    return `<p style="margin:24px 0;text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:${COLORS.accent};">${escapeHtml(code)}</p>`
}
