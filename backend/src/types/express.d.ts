export type UserRole = "ADMIN" | "MANAGER" | "USER"

export interface AuthUser {
    id: string
    role: UserRole
}

declare global {
    namespace Express {
        interface Request {
            // Set by the `authenticate` middleware
            user?: AuthUser
        }
    }
}
