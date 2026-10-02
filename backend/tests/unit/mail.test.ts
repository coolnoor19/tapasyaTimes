import { describe, expect, it } from "vitest"
import { escapeHtml, renderCodeBox, renderLayout } from "../../src/mail/layout.js"
import { verifyEmailTemplate } from "../../src/mail/templates/verifyEmail.js"

describe("escapeHtml", () => {
    it("escapes every HTML-significant character", () => {
        expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
            "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
        )
    })

    it("leaves plain text unchanged", () => {
        expect(escapeHtml("Noor Alam 123")).toBe("Noor Alam 123")
    })
})

describe("renderLayout / renderCodeBox", () => {
    it("wraps body HTML in the shared layout with brand, preheader and footer", () => {
        const html = renderLayout({ preheader: "Preview <text>", bodyHtml: "<p>Body</p>" })
        expect(html).toContain("<p>Body</p>")
        expect(html).toContain("Tapasya Times")
        expect(html).toContain("Preview &lt;text&gt;")
        expect(html).toContain("automated message")
    })

    it("escapes the code box content", () => {
        expect(renderCodeBox("<b>1</b>")).not.toContain("<b>1</b>")
    })
})

describe("verifyEmailTemplate", () => {
    const mail = verifyEmailTemplate({ firstName: "Noor", code: "482913", expiresInMinutes: 10 })

    it("puts the code in the HTML and plain-text bodies", () => {
        expect(mail.html).toContain("482913")
        expect(mail.text).toContain("482913")
    })

    it("never puts the code in the subject (lock screens show subjects)", () => {
        expect(mail.subject).not.toContain("482913")
    })

    it("mentions the expiry and warns not to share the code", () => {
        expect(mail.text).toContain("10 minutes")
        expect(mail.text.toLowerCase()).toContain("never share")
    })

    it("escapes a malicious first name in HTML but keeps it readable in text", () => {
        const evil = verifyEmailTemplate({
            firstName: `<script>alert(1)</script>`,
            code: "123456",
            expiresInMinutes: 10,
        })
        expect(evil.html).not.toContain("<script>")
        expect(evil.html).toContain("&lt;script&gt;")
        expect(evil.text).toContain("<script>alert(1)</script>")
    })
})
