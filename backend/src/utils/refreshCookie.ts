import type { CookieOptions, Response } from "express"
import { env } from "../config/env.js"
import { REFRESH_TOKEN_TTL_MS } from "./token.util.js"

export const REFRESH_COOKIE_NAME = "refresh_token"

const baseOptions = (): CookieOptions => ({
    httpOnly: true, // JavaScript on the page can never read it (blocks theft via XSS)
    secure: env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // never sent on requests started by another site
    path: "/api/v1/auth", // only sent to the auth endpoints, not to every API call
})

export function setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE_NAME, token, { ...baseOptions(), maxAge: REFRESH_TOKEN_TTL_MS })
}

export function clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, baseOptions())
}
