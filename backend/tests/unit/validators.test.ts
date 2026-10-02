import { describe, expect, it } from "vitest"
import {
    loginSchema,
    registerSchema,
    resendVerificationSchema,
    verifyEmailSchema,
} from "../../src/validators/auth.validator.js"

const validRegistration = {
    firstName: "Noor",
    lastName: "Alam",
    email: "noor@example.com",
    phone: "9876543210",
    password: "password123",
}

describe("registerSchema", () => {
    it("accepts a valid registration", () => {
        expect(registerSchema.safeParse(validRegistration).success).toBe(true)
    })

    it("trims names and lowercases + trims the email", () => {
        const result = registerSchema.parse({
            ...validRegistration,
            firstName: "  Noor ",
            email: "  Noor@Example.COM ",
        })
        expect(result.firstName).toBe("Noor")
        expect(result.email).toBe("noor@example.com")
    })

    it.each([
        ["missing first name", { firstName: "" }],
        ["whitespace-only last name", { lastName: "   " }],
        ["invalid email", { email: "not-an-email" }],
        ["phone with letters", { phone: "98765abc10" }],
        ["phone too short", { phone: "12345" }],
        ["phone too long", { phone: "1234567890123456" }],
        ["password shorter than 8", { password: "short" }],
        ["password longer than 72 (bcrypt ignores the rest)", { password: "a".repeat(73) }],
    ])("rejects %s", (_label, override) => {
        expect(registerSchema.safeParse({ ...validRegistration, ...override }).success).toBe(false)
    })

    it("accepts a phone with a leading + and a 72-char password", () => {
        const result = registerSchema.safeParse({ ...validRegistration, phone: "+919876543210", password: "a".repeat(72) })
        expect(result.success).toBe(true)
    })

    it("names the failing field in the error", () => {
        const result = registerSchema.safeParse({ ...validRegistration, phone: "abc" })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.path).toEqual(["phone"])
    })

    it("rejects missing fields", () => {
        expect(registerSchema.safeParse({}).success).toBe(false)
    })
})

describe("loginSchema", () => {
    it("accepts email + password and lowercases the email", () => {
        expect(loginSchema.parse({ email: "A@B.com", password: "x" }).email).toBe("a@b.com")
    })

    it("rejects an empty password", () => {
        expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false)
    })
})

describe("verifyEmailSchema", () => {
    it("accepts exactly 6 digits, trimming whitespace", () => {
        expect(verifyEmailSchema.parse({ email: "a@b.com", code: " 012345 " }).code).toBe("012345")
    })

    it.each(["12345", "1234567", "abcdef", "12 456", "12345a", ""])("rejects code %j", (code) => {
        expect(verifyEmailSchema.safeParse({ email: "a@b.com", code }).success).toBe(false)
    })

    it("rejects a numeric code (must be a string so leading zeros survive)", () => {
        expect(verifyEmailSchema.safeParse({ email: "a@b.com", code: 123456 }).success).toBe(false)
    })
})

describe("resendVerificationSchema", () => {
    it("requires a valid email", () => {
        expect(resendVerificationSchema.safeParse({ email: "x" }).success).toBe(false)
        expect(resendVerificationSchema.safeParse({ email: "x@y.com" }).success).toBe(true)
    })
})
