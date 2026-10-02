import type { NextFunction, Request, Response } from "express"
import { AppError } from "../utils/errors/AppError.js"
import { logger } from "../utils/logger.js"

// Errors from express.json() (bad JSON, body too large) carry a `type` string.
function getBodyParserStatus(err: unknown): { status: number; message: string } | undefined {
    if (!err || typeof err !== "object" || !("type" in err)) return undefined
    if (err.type === "entity.parse.failed") return { status: 400, message: "Invalid JSON body" }
    if (err.type === "entity.too.large") return { status: 413, message: "Request body too large" }
    return undefined
}

// Drizzle puts the SQL parameters (emails, password hashes) in the wrapper
// error's message and stack. The underlying driver error (`cause`) does not.
function toSafeError(err: unknown) {
    const source = err instanceof Error && err.cause instanceof Error ? err.cause : err
    if (!(source instanceof Error)) return { message: "Non-error value thrown" }
    const { code } = source as { code?: unknown }
    return { name: source.name, message: source.message, code, stack: source.stack }
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) return next(err)

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message })
    }

    const bodyError = getBodyParserStatus(err)
    if (bodyError) {
        return res.status(bodyError.status).json({ message: bodyError.message })
    }

    const log = req.log ?? logger
    log.error({ err: toSafeError(err) }, "Unhandled error")
    return res.status(500).json({ message: "Internal server error" })
}
