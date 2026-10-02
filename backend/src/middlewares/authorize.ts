import type { NextFunction, Request, Response } from "express"
import type { UserRole } from "../types/express.js"
import { ForbiddenError } from "../utils/errors/ForbiddenError.js"
import { UnauthorizedError } from "../utils/errors/UnauthorizedError.js"

// Use AFTER `authenticate`:  router.get("/x", authenticate, authorize("ADMIN"), handler)
// Roles are exact, not hierarchical: a MANAGER does not automatically get ADMIN access.
export function authorize(...allowedRoles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) return next(new UnauthorizedError("Authentication required", "AUTH_REQUIRED"))
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError("You do not have permission to do this", "FORBIDDEN"))
        }
        next()
    }
}
