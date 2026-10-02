import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { refreshTokensTable as refreshTokens, usersTable } from "../db/schema.js"
import { comparePassword, DUMMY_PASSWORD_HASH } from "../utils/hash.util.js"
import { ForbiddenError } from "../utils/errors/ForbiddenError.js"
import { UnauthorizedError } from "../utils/errors/UnauthorizedError.js"
import {
    generateRefreshToken,
    hashRefreshToken,
    REFRESH_TOKEN_TTL_MS,
    signAccessToken,
} from "../utils/token.util.js"

// Security settings (not business rules).
const MAX_FAILED_LOGINS = 5
const LOCK_MINUTES = 15
// Two browser tabs may refresh with the same token at nearly the same moment.
// Reuse of a rotated token inside this window is a harmless race; after it, it
// means the token was stolen.
const REUSE_GRACE_MS = 10_000

type Executor = Pick<typeof db, "insert">

export interface SessionUser {
    id: string
    firstName: string
    lastName: string
    email: string
    role: "ADMIN" | "MANAGER" | "USER"
}

export interface Session {
    accessToken: string
    refreshToken: string
    user: SessionUser
}

// Same message for unknown email, wrong password and locked account, so the
// endpoint reveals nothing about which accounts exist.
const invalidCredentials = () => new UnauthorizedError("Invalid email or password")

async function insertRefreshToken(executor: Executor, userId: string): Promise<{ id: string; raw: string }> {
    const raw = generateRefreshToken()
    const [row] = await executor
        .insert(refreshTokens)
        .values({
            userId,
            tokenHash: hashRefreshToken(raw),
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        })
        .returning({ id: refreshTokens.id })
    return { id: row!.id, raw }
}

async function startSession(user: SessionUser): Promise<Session> {
    const [accessToken, refresh] = await Promise.all([signAccessToken(user.id), insertRefreshToken(db, user.id)])
    return { accessToken, refreshToken: refresh.raw, user }
}

export async function login(email: string, password: string): Promise<Session> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email))

    if (!user) {
        await comparePassword(password, DUMMY_PASSWORD_HASH)
        throw invalidCredentials()
    }

    const now = new Date()
    if (user.lockedUntil && user.lockedUntil > now) {
        await comparePassword(password, DUMMY_PASSWORD_HASH)
        throw invalidCredentials()
    }
    if (user.lockedUntil) {
        // The lock has run out: start counting from zero again.
        await db.update(usersTable).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(usersTable.id, user.id))
        user.failedLoginAttempts = 0
    }

    if (!(await comparePassword(password, user.passwordHash))) {
        // Atomic increment, so parallel guesses cannot dodge the counter.
        await db
            .update(usersTable)
            .set({
                failedLoginAttempts: sql`${usersTable.failedLoginAttempts} + 1`,
                lockedUntil: sql`CASE WHEN ${usersTable.failedLoginAttempts} + 1 >= ${MAX_FAILED_LOGINS}
                    THEN now() + make_interval(mins => ${LOCK_MINUTES}) ELSE ${usersTable.lockedUntil} END`,
            })
            .where(eq(usersTable.id, user.id))
        throw invalidCredentials()
    }

    // Correct password from here on, so it is safe to say why login is refused.
    if (user.status !== "ACTIVE") {
        throw new ForbiddenError("This account is suspended", "ACCOUNT_SUSPENDED")
    }
    if (!user.isVerified) {
        throw new ForbiddenError("Please verify your email first", "EMAIL_NOT_VERIFIED")
    }

    if (user.failedLoginAttempts > 0) {
        await db.update(usersTable).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(usersTable.id, user.id))
    }

    return startSession({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
    })
}

// Swaps a refresh token for a new one (rotation). Each token works exactly once.
export async function refreshSession(rawToken: string): Promise<Session> {
    const tokenHash = hashRefreshToken(rawToken)
    const now = new Date()

    const session = await db.transaction(async (tx) => {
        // Atomic claim: of several simultaneous requests with the same token, only one matches.
        const [claimed] = await tx
            .update(refreshTokens)
            .set({ revokedAt: now })
            .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, now)))
            .returning({ id: refreshTokens.id, userId: refreshTokens.userId })
        if (!claimed) return undefined

        const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, claimed.userId))
        if (!user || user.status !== "ACTIVE" || !user.isVerified) return undefined

        const next = await insertRefreshToken(tx, user.id)
        await tx.update(refreshTokens).set({ replacedById: next.id }).where(eq(refreshTokens.id, claimed.id))

        return {
            refreshToken: next.raw,
            user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
        }
    })

    if (session) {
        return { ...session, accessToken: await signAccessToken(session.user.id) }
    }

    await handlePossibleTheft(tokenHash, now)
    throw new UnauthorizedError("Invalid or expired session", "SESSION_INVALID")
}

// A token that was already rotated is being used again. If that happens well after
// the rotation, assume it was stolen and end every session of that user.
async function handlePossibleTheft(tokenHash: string, now: Date) {
    const [old] = await db
        .select({ userId: refreshTokens.userId, revokedAt: refreshTokens.revokedAt, replacedById: refreshTokens.replacedById })
        .from(refreshTokens)
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNotNull(refreshTokens.replacedById)))

    if (old?.revokedAt && now.getTime() - old.revokedAt.getTime() > REUSE_GRACE_MS) {
        await revokeAllSessions(old.userId)
    }
}

export async function logout(rawToken: string): Promise<void> {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, hashRefreshToken(rawToken)), isNull(refreshTokens.revokedAt)))
}

export async function revokeAllSessions(userId: string): Promise<void> {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
}
