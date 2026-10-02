import type { NextFunction, Request, Response } from "express"
import type { ZodType } from "zod"
import { BadRequestError } from "../utils/errors/BadRequestError.js"

// Name the field so the client knows what to fix: "email: Invalid email address"
function describeIssues(issues: { path: PropertyKey[]; message: string }[]) {
    return issues
        .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
        .join(", ")
}

// Validates req.body and replaces it with the cleaned result.
export function validate(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)

        if (!result.success) {
            return next(new BadRequestError(describeIssues(result.error.issues)))
        }

        req.body = result.data
        next()
    }
}

// Validates req.query. Express 5 makes req.query read-only, so the cleaned result
// is placed in res.locals.query instead.
export function validateQuery(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.query)

        if (!result.success) {
            return next(new BadRequestError(describeIssues(result.error.issues)))
        }

        res.locals.query = result.data
        next()
    }
}
