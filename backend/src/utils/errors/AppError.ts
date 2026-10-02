export class AppError extends Error {
    public readonly statusCode: number
    public readonly isOperational: boolean
    // Optional machine-readable reason (e.g. "TOKEN_EXPIRED") so the frontend can react
    public readonly code: string | undefined

    constructor(message: string, statusCode: number, code?: string) {
        super(message)

        this.statusCode = statusCode
        this.isOperational = true
        this.code = code

        Object.setPrototypeOf(this, new.target.prototype)
        Error.captureStackTrace(this, this.constructor)
    }
}
