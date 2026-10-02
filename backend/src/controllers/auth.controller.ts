import type { Request, Response, NextFunction } from "express"
import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { usersTable } from "../db/schema.js"
import { hashPassword } from "../utils/hash.util.js"
import { ConflictError } from "../utils/errors/ConflictError.js"
import type { RegisterUserDto } from "../types/auth.types.js"
import type { PublicUser } from "../types/user.types.js"

export async function registerUserHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, email, password }: RegisterUserDto = req.body

        const [existingUser] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email))

        if (existingUser) {
            throw new ConflictError("Email is already registered")
        }

        const passwordHash = await hashPassword(password)

        const [createdUser] = await db
            .insert(usersTable)
            .values({ name, email, passwordHash })
            .returning({
                id: usersTable.id,
                name: usersTable.name,
                email: usersTable.email,
            })

        const publicUser: PublicUser = {
            id: createdUser!.id,
            name: createdUser!.name,
            email: createdUser!.email,
        }

        res.status(201).json(publicUser)
    } catch (err) {
        next(err)
    }
}
