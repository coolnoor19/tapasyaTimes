import type { Response } from "supertest"
import { hashPassword } from "../../src/utils/hash.util.js"
import { createUser } from "./factories.js"

export const PASSWORD = "password123"

// bcrypt is slow on purpose, so hash the shared test password only once.
let passwordHash: Promise<string> | undefined

export async function createVerifiedUser(overrides: Parameters<typeof createUser>[0] = {}) {
    passwordHash ??= hashPassword(PASSWORD)
    return createUser({ passwordHash: await passwordHash, isVerified: true, ...overrides })
}

// The raw Set-Cookie line for the refresh cookie, if the response sets one.
export function refreshCookieLine(res: Response): string | undefined {
    const header = res.headers["set-cookie"] as unknown as string[] | undefined
    return header?.find((line) => line.startsWith("refresh_token="))
}

// The cookie's value ("" when the server cleared it), or undefined when absent.
export function refreshCookieValue(res: Response): string | undefined {
    const line = refreshCookieLine(res)
    return line?.split(";")[0]?.slice("refresh_token=".length)
}

export const cookieHeader = (value: string) => `refresh_token=${value}`
