import { describe, expect, it } from "vitest"
import { generateOtp, hashOtp, safeEqualHex } from "../../src/utils/otp.util.js"

describe("generateOtp", () => {
    it("always returns exactly 6 digits", () => {
        for (let i = 0; i < 2000; i++) {
            expect(generateOtp()).toMatch(/^\d{6}$/)
        }
    })

    it("is not constant", () => {
        const codes = new Set(Array.from({ length: 50 }, generateOtp))
        expect(codes.size).toBeGreaterThan(1)
    })
})

describe("hashOtp", () => {
    it("returns a 64-char hex string and is deterministic", () => {
        const hash = hashOtp("user-1", "token-1", "123456")
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
        expect(hashOtp("user-1", "token-1", "123456")).toBe(hash)
    })

    it("changes when the user, the token row or the code changes", () => {
        const base = hashOtp("user-1", "token-1", "123456")
        expect(hashOtp("user-2", "token-1", "123456")).not.toBe(base)
        expect(hashOtp("user-1", "token-2", "123456")).not.toBe(base)
        expect(hashOtp("user-1", "token-1", "123457")).not.toBe(base)
    })

    it("does not contain the plain code", () => {
        expect(hashOtp("user-1", "token-1", "123456")).not.toContain("123456")
    })
})

describe("safeEqualHex", () => {
    const hash = hashOtp("user-1", "token-1", "123456")

    it("accepts identical hashes", () => {
        expect(safeEqualHex(hash, hash)).toBe(true)
    })

    it("rejects different hashes", () => {
        expect(safeEqualHex(hash, hashOtp("user-1", "token-1", "654321"))).toBe(false)
    })

    it("rejects different lengths", () => {
        expect(safeEqualHex(hash, hash.slice(0, 32))).toBe(false)
        expect(safeEqualHex(hash, "")).toBe(false)
    })

    it("rejects non-hex input instead of treating two garbage strings as equal", () => {
        expect(safeEqualHex("zz", "yy")).toBe(false)
        expect(safeEqualHex("zz", "zz")).toBe(false)
        expect(safeEqualHex("", "")).toBe(false)
    })
})
