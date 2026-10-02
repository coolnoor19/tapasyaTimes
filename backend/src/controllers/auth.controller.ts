import type { Request, Response, NextFunction } from "express"
import { db } from "../db/index.js"
import { usersTable } from "../db/schema.js"
import { hashPassword } from "../utils/hash.util.js"
import { getUniqueViolation } from "../utils/dbErrors.js"
import { toSafeError } from "../utils/safeError.js"
import { ConflictError } from "../utils/errors/ConflictError.js"
import {
    resendVerificationCode,
    sendVerificationCode,
    verifyEmailCode,
} from "../services/emailVerification.service.js"
import type { RegisterUserDto, ResendVerificationDto, VerifyEmailDto } from "../types/auth.types.js"
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

        // Email is sent in the background: a slow or broken mail server must not
        // fail the registration. The user can request a new code if it never arrives.
        void sendVerificationCode(publicUser).catch((err) =>
            req.log.error({ err: toSafeError(err) }, "Failed to send verification email"),
        )

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

export async function verifyEmailHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, code }: VerifyEmailDto = req.body
        await verifyEmailCode(email, code)
        res.status(200).json({ message: "Email verified" })
    } catch (err) {
        next(err)
    }
}

export async function resendVerificationHandler(req: Request, res: Response) {
    const { email }: ResendVerificationDto = req.body

    // Same answer whether or not the account exists, and sent in the background
    // so response time does not reveal it either.
    void resendVerificationCode(email).catch((err) =>
        req.log.error({ err: toSafeError(err) }, "Failed to resend verification email"),
    )

    res.status(200).json({ message: "If the account exists and is not verified, a new code has been sent" })
}
