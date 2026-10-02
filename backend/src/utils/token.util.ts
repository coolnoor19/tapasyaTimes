import { createHash, randomBytes } from "node:crypto"
import { errors, jwtVerify, SignJWT } from "jose"
import { env } from "../config/env.js"
import { UnauthorizedError } from "./errors/UnauthorizedError.js"

// Session lengths (agreed): short-lived access token, long-lived rotating refresh token.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

const ISSUER = "tapasya-times"
const AUDIENCE = "tapasya-times-api"
const secretKey = () => new TextEncoder().encode(env.JWT_ACCESS_SECRET)

// The access token carries only the user id. Role and status are read from the
// database on every request, so a role change or suspension applies immediately
// instead of after the token expires.
export async function signAccessToken(userId: string): Promise<string> {
    return new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
        .sign(secretKey())
}

// Returns the user id, or throws a 401. `TOKEN_EXPIRED` tells the frontend to refresh.
export async function verifyAccessToken(token: string): Promise<string> {
    try {
        const { payload } = await jwtVerify(token, secretKey(), {
            algorithms: ["HS256"],
            issuer: ISSUER,
            audience: AUDIENCE,
        })
        if (!payload.sub) throw new UnauthorizedError("Invalid token", "TOKEN_INVALID")
        return payload.sub
    } catch (err) {
        if (err instanceof UnauthorizedError) throw err
        if (err instanceof errors.JWTExpired) throw new UnauthorizedError("Token expired", "TOKEN_EXPIRED")
        throw new UnauthorizedError("Invalid token", "TOKEN_INVALID")
    }
}

// 256 random bits. Only its SHA-256 is stored, so a database leak cannot be
// used to log in. (A fast hash is fine here because the token is random, not a password.)
export function generateRefreshToken(): string {
    return randomBytes(32).toString("base64url")
}

export function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex")
}
