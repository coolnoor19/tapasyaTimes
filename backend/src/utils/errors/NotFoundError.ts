import { AppError } from "./AppError.js"

export class NotFoundError extends AppError {
    constructor(message = "Not found", code?: string) {
        super(message, 404, code)
    }
}
