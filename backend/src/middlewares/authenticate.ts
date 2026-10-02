import type { NextFunction, Request, Response } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { usersTable } from "../db/schema.js"
import { UnauthorizedError } from "../utils/errors/UnauthorizedError.js"
import { verifyAccessToken } from "../utils/token.util.js"

// Requires `Authorization: Bearer <access token>`. Sets req.user from the DATABASE
// (not from the token), so a suspended user or a changed role takes effect at once.
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
    try {
        const [scheme, token] = req.headers.authorization?.split(" ") ?? []
        if (scheme?.toLowerCase() !== "bearer" || !token) {
            throw new UnauthorizedError("Authentication required", "AUTH_REQUIRED")
        }

        const userId = await verifyAccessToken(token)

        const [user] = await db
            .select({ id: usersTable.id, role: usersTable.role, status: usersTable.status })
            .from(usersTable)
            .where(eq(usersTable.id, userId))

        if (!user || user.status !== "ACTIVE") {
            throw new UnauthorizedError("Invalid token", "TOKEN_INVALID")
        }

        req.user = { id: user.id, role: user.role }
        next()
    } catch (err) {
        next(err)
    }
}
