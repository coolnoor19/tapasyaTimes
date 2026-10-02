import { AppError } from "./AppError.js"

export class ConflictError extends AppError {
    constructor(message = "Conflict", code?: string, details?: Record<string, unknown>) {
        super(message, 409, code, details)
    }
}
