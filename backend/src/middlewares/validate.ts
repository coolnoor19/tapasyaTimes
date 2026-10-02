import type { NextFunction, Request, Response } from "express"
import type { ZodType } from "zod"
import { BadRequestError } from "../utils/errors/BadRequestError.js"

export function validate(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)

        if (!result.success) {
            // Name the field so the client knows what to fix: "email: Invalid email address"
            const message = result.error.issues
                .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
                .join(", ")
            return next(new BadRequestError(message))
        }

        req.body = result.data
        next()
    }
}
