import { describe, expect, it } from "vitest"
import { getUniqueViolation } from "../../src/utils/dbErrors.js"
import { toSafeError } from "../../src/utils/safeError.js"

describe("getUniqueViolation", () => {
    it("detects a unique violation and returns the constraint name", () => {
        expect(getUniqueViolation({ code: "23505", constraint: "users_email_unique" })).toEqual({
            constraint: "users_email_unique",
        })
    })

    it("finds the error inside Drizzle's wrapper (cause)", () => {
        const wrapped = { message: "Failed query", cause: { code: "23505", constraint: "users_phone_unique" } }
        expect(getUniqueViolation(wrapped)?.constraint).toBe("users_phone_unique")
    })

    it("finds the error up to 3 levels deep", () => {
        const deep = { cause: { cause: { code: "23505", constraint: "x" } } }
        expect(getUniqueViolation(deep)?.constraint).toBe("x")
    })

    it("ignores other database errors", () => {
        expect(getUniqueViolation({ code: "23514" })).toBeUndefined()
        expect(getUniqueViolation({ code: "42703" })).toBeUndefined()
    })

    it("ignores non-database values", () => {
        expect(getUniqueViolation(undefined)).toBeUndefined()
        expect(getUniqueViolation(null)).toBeUndefined()
        expect(getUniqueViolation("boom")).toBeUndefined()
        expect(getUniqueViolation(new Error("plain"))).toBeUndefined()
    })
})

describe("toSafeError", () => {
    it("logs the driver error, not Drizzle's wrapper which contains the SQL params", () => {
        const driver = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" })
        const wrapper = new Error("Failed query: insert ...\nparams: victim@example.com,$2b$10$hashhashhash", {
            cause: driver,
        })

        const safe = toSafeError(wrapper)

        expect(safe.message).toBe("connection refused")
        expect(safe).toMatchObject({ code: "ECONNREFUSED" })
        const serialised = JSON.stringify(safe)
        expect(serialised).not.toContain("victim@example.com")
        expect(serialised).not.toContain("$2b$")
    })

    it("uses the error itself when it has no cause", () => {
        expect(toSafeError(new Error("plain")).message).toBe("plain")
    })

    it("handles thrown non-errors without leaking them", () => {
        expect(toSafeError("secret string")).toEqual({ message: "Non-error value thrown" })
        expect(toSafeError(undefined)).toEqual({ message: "Non-error value thrown" })
    })
})
