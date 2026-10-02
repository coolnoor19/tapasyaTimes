import type { NextFunction, Request, Response } from "express"
import { env } from "../config/env.js"
import { ForbiddenError } from "../utils/errors/ForbiddenError.js"

// Extra protection (on top of SameSite=Strict) for endpoints that act on the
// refresh cookie: a browser always sends `Origin` on POST, so a request coming
// from any site other than our frontend is refused. Non-browser clients send no
// Origin and are unaffected (they still need the cookie).
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
    const origin = req.headers.origin
    if (origin && !env.CORS_ORIGINS.includes(origin)) {
        return next(new ForbiddenError("Origin not allowed"))
    }
    next()
}
