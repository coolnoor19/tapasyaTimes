export class AppError extends Error {
    public readonly statusCode: number
    public readonly isOperational: boolean
    // Optional machine-readable reason (e.g. "TOKEN_EXPIRED") so the frontend can react
    public readonly code: string | undefined
    // Optional structured data for the client (e.g. which dates conflicted)
    public readonly details: Record<string, unknown> | undefined

    constructor(message: string, statusCode: number, code?: string, details?: Record<string, unknown>) {
        super(message)

        this.statusCode = statusCode
        this.isOperational = true
        this.code = code
        this.details = details

        Object.setPrototypeOf(this, new.target.prototype)
        Error.captureStackTrace(this, this.constructor)
    }
}
