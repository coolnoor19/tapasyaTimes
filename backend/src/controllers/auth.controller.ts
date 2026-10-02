import type { Request, Response, NextFunction } from "express"
import { eq } from "drizzle-orm"
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
import { login, logout, refreshSession, revokeAllSessions, type Session } from "../services/auth.service.js"
import { UnauthorizedError } from "../utils/errors/UnauthorizedError.js"
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "../utils/refreshCookie.js"
import { ACCESS_TOKEN_TTL_SECONDS } from "../utils/token.util.js"
import type { LoginUserDto, RegisterUserDto, ResendVerificationDto, VerifyEmailDto } from "../types/auth.types.js"
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

// The refresh token travels only in the httpOnly cookie, never in the JSON body.
// The access token is returned in the body; the frontend keeps it in memory.
function sendSession(res: Response, session: Session) {
    setRefreshCookie(res, session.refreshToken)
    res.set("Cache-Control", "no-store")
    res.status(200).json({
        accessToken: session.accessToken,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: session.user,
    })
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password }: LoginUserDto = req.body
        sendSession(res, await login(email, password))
    } catch (err) {
        next(err)
    }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME]
        if (typeof token !== "string" || !token) {
            throw new UnauthorizedError("Invalid or expired session", "SESSION_INVALID")
        }
        sendSession(res, await refreshSession(token))
    } catch (err) {
        // A failed refresh means the cookie is useless; drop it.
        if (err instanceof UnauthorizedError) clearRefreshCookie(res)
        next(err)
    }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const token: unknown = req.cookies?.[REFRESH_COOKIE_NAME]
        if (typeof token === "string" && token) await logout(token)
        clearRefreshCookie(res)
        res.status(200).json({ message: "Logged out" })
    } catch (err) {
        next(err)
    }
}

export async function logoutAllHandler(req: Request, res: Response, next: NextFunction) {
    try {
        await revokeAllSessions(req.user!.id)
        clearRefreshCookie(res)
        res.status(200).json({ message: "Logged out of all devices" })
    } catch (err) {
        next(err)
    }
}

export async function meHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const [user] = await db
            .select({
                id: usersTable.id,
                firstName: usersTable.firstName,
                lastName: usersTable.lastName,
                email: usersTable.email,
                phone: usersTable.phone,
                role: usersTable.role,
                isVerified: usersTable.isVerified,
            })
            .from(usersTable)
            .where(eq(usersTable.id, req.user!.id))
        res.status(200).json(user)
    } catch (err) {
        next(err)
    }
}
