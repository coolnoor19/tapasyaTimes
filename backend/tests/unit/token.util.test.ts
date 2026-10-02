import { describe, expect, it } from "vitest"
import { SignJWT, UnsecuredJWT } from "jose"
import { env } from "../../src/config/env.js"
import {
    ACCESS_TOKEN_TTL_SECONDS,
    generateRefreshToken,
    hashRefreshToken,
    REFRESH_TOKEN_TTL_MS,
    signAccessToken,
    verifyAccessToken,
} from "../../src/utils/token.util.js"

const key = (secret: string) => new TextEncoder().encode(secret)
const goodKey = () => key(env.JWT_ACCESS_SECRET)

// Builds a token with the RIGHT secret but chosen claims, to test one rule at a time.
function craft(claims: { sub?: string; iss?: string; aud?: string; exp?: number | string; secret?: Uint8Array }) {
    const jwt = new SignJWT({}).setProtectedHeader({ alg: "HS256" })
    if (claims.sub !== undefined) jwt.setSubject(claims.sub)
    jwt.setIssuer(claims.iss ?? "tapasya-times").setAudience(claims.aud ?? "tapasya-times-api").setIssuedAt()
    jwt.setExpirationTime(claims.exp ?? "5m")
    return jwt.sign(claims.secret ?? goodKey())
}

const codeOf = async (token: string) => verifyAccessToken(token).then(() => "OK", (e: { code?: string }) => e.code)

describe("session lengths", () => {
    it("access token lives 15 minutes, refresh token 30 days", () => {
        expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60)
        expect(REFRESH_TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
    })
})

describe("access tokens", () => {
    it("round-trips the user id", async () => {
        const token = await signAccessToken("user-123")
        expect(token.split(".")).toHaveLength(3)
        expect(await verifyAccessToken(token)).toBe("user-123")
    })

    it("expires after 15 minutes", async () => {
        const token = await signAccessToken("user-123")
        const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString())
        expect(payload.exp - payload.iat).toBe(900)
    })

    it("carries only the user id, never role, email or other personal data", async () => {
        const token = await signAccessToken("user-123")
        const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString())
        expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "sub"])
    })

    it("rejects an expired token with TOKEN_EXPIRED", async () => {
        const expired = await craft({ sub: "u", exp: Math.floor(Date.now() / 1000) - 60 })
        expect(await codeOf(expired)).toBe("TOKEN_EXPIRED")
    })

    it("rejects a token signed with a different secret", async () => {
        const forged = await craft({ sub: "u", secret: key("some-other-secret-0123456789abcdefghij") })
        expect(await codeOf(forged)).toBe("TOKEN_INVALID")
    })

    it("rejects a tampered payload", async () => {
        const token = await signAccessToken("victim")
        const [header, , signature] = token.split(".")
        const evilPayload = Buffer.from(JSON.stringify({ sub: "admin", iss: "tapasya-times", aud: "tapasya-times-api" })).toString("base64url")
        expect(await codeOf(`${header}.${evilPayload}.${signature}`)).toBe("TOKEN_INVALID")
    })

    it("rejects an unsigned token (alg: none attack)", async () => {
        const unsigned = new UnsecuredJWT({}).setSubject("admin").setIssuer("tapasya-times").setAudience("tapasya-times-api").encode()
        expect(await codeOf(unsigned)).toBe("TOKEN_INVALID")
    })

    it("rejects a token for another audience or issuer", async () => {
        expect(await codeOf(await craft({ sub: "u", aud: "someone-else" }))).toBe("TOKEN_INVALID")
        expect(await codeOf(await craft({ sub: "u", iss: "someone-else" }))).toBe("TOKEN_INVALID")
    })

    it("rejects a token with no subject", async () => {
        expect(await codeOf(await craft({}))).toBe("TOKEN_INVALID")
    })

    it.each(["", "abc", "a.b.c", "Bearer x"])("rejects garbage %j", async (garbage) => {
        expect(await codeOf(garbage)).toBe("TOKEN_INVALID")
    })
})

describe("refresh tokens", () => {
    it("are long, URL-safe and unique", () => {
        const tokens = Array.from({ length: 200 }, generateRefreshToken)
        expect(new Set(tokens).size).toBe(200)
        for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    })

    it("are stored as a SHA-256 hash that does not contain the token", () => {
        const token = generateRefreshToken()
        const hash = hashRefreshToken(token)
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
        expect(hash).not.toContain(token)
        expect(hashRefreshToken(token)).toBe(hash)
        expect(hashRefreshToken(generateRefreshToken())).not.toBe(hash)
    })
})
