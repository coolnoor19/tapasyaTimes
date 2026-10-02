import { createHmac, randomInt, timingSafeEqual } from "node:crypto"
import { env } from "../config/env.js"

// Cryptographically secure 6-digit code (Math.random is predictable).
export function generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

// Keyed hash of the code. Bound to the user and the token row so the same code
// never produces the same hash twice, and useless without OTP_HMAC_SECRET.
export function hashOtp(userId: string, tokenId: string, code: string): string {
    return createHmac("sha256", env.OTP_HMAC_SECRET).update(`${userId}:${tokenId}:${code}`).digest("hex")
}

export function safeEqualHex(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, "hex")
    const bufferB = Buffer.from(b, "hex")
    // Non-hex input decodes to an empty buffer, so reject empty ones explicitly:
    // two different garbage strings must never count as equal.
    if (a.length !== b.length || bufferA.length === 0 || bufferA.length !== bufferB.length) return false
    return timingSafeEqual(bufferA, bufferB)
}
