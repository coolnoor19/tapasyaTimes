import type { Request, Response, NextFunction } from "express"
import { db } from "../db/index.js"
import { usersTable } from "../db/schema.js"
import { hashPassword } from "../utils/hash.util.js"
import { getUniqueViolation } from "../utils/dbErrors.js"
import { ConflictError } from "../utils/errors/ConflictError.js"
import type { RegisterUserDto } from "../types/auth.types.js"
import type { PublicUser } from "../types/user.types.js"

export async function registerUserHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { firstName, lastName, email, phone, password }: RegisterUserDto = req.body

        const passwordHash = await hashPassword(password)

        // The unique constraints are the source of truth for duplicates: a
        // select-then-insert check would race when two requests arrive together.
        const [createdUser] = await db
            .insert(usersTable)
            .values({ firstName, lastName, email, phone, passwordHash })
            .returning({
                id: usersTable.id,
                firstName: usersTable.firstName,
                lastName: usersTable.lastName,
                email: usersTable.email,
            })

        const publicUser: PublicUser = createdUser!

        res.status(201).json(publicUser)
    } catch (err) {
        const violation = getUniqueViolation(err)
        if (violation) {
            const field = violation.constraint?.includes("phone") ? "Phone number" : "Email"
            return next(new ConflictError(`${field} is already registered`))
        }
        next(err)
    }
}
