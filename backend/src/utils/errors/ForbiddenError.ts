import { AppError } from "./AppError.js"

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", code?: string) {
        super(message, 403, code)
    }
}
