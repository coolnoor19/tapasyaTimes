import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm"
import { db } from "../../db/index.js"
import { bookingsTable, refreshTokensTable, usersTable as users } from "../../db/schema.js"
import { ConflictError } from "../../utils/errors/ConflictError.js"
import { ForbiddenError } from "../../utils/errors/ForbiddenError.js"
import { NotFoundError } from "../../utils/errors/NotFoundError.js"
import { recordAudit } from "./audit.service.js"

type UserRow = typeof users.$inferSelect

// Explicit columns only. The password hash and lockout counters never leave the server.
const toUserView = (user: UserRow, now: Date) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified,
    isLocked: user.lockedUntil !== null && user.lockedUntil > now,
    createdAt: user.createdAt.toISOString(),
})

// Treat the search text literally: "%" and "_" are wildcards in LIKE, so escape them.
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`)

const ADMIN_PROTECTED = () =>
    new ForbiddenError("Admin accounts cannot be changed through the API", "ADMIN_PROTECTED")

export async function listUsers(
    filters: {
        search?: string | undefined
        role?: UserRow["role"] | undefined
        status?: UserRow["status"] | undefined
        isVerified?: boolean | undefined
    },
    page: number,
    limit: number,
    now: Date = new Date(),
) {
    let searchCondition: SQL | undefined
    if (filters.search) {
        const pattern = `%${escapeLike(filters.search)}%`
        searchCondition = or(
            ilike(users.email, pattern),
            ilike(users.phone, pattern),
            ilike(users.firstName, pattern),
            ilike(users.lastName, pattern),
            ilike(sql`${users.firstName} || ' ' || ${users.lastName}`, pattern),
        )
    }
    const where = and(
        searchCondition,
        filters.role ? eq(users.role, filters.role) : undefined,
        filters.status ? eq(users.status, filters.status) : undefined,
        filters.isVerified === undefined ? undefined : eq(users.isVerified, filters.isVerified),
    )

    const [rows, [totalRow]] = await Promise.all([
        db
            .select()
            .from(users)
            .where(where)
            .orderBy(desc(users.createdAt), desc(users.id))
            .limit(limit)
            .offset((page - 1) * limit),
        db.select({ total: count() }).from(users).where(where),
    ])

    return { data: rows.map((row) => toUserView(row, now)), page, limit, total: totalRow?.total ?? 0 }
}

export async function getUser(userId: string, now: Date = new Date()) {
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) throw new NotFoundError("User not found")

    const [bookingRow] = await db.select({ total: count() }).from(bookingsTable).where(eq(bookingsTable.userId, userId))
    return { ...toUserView(user, now), bookingCount: bookingRow?.total ?? 0 }
}

export async function setUserStatus(actorId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
    return db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update")
        if (!user) throw new NotFoundError("User not found")
        if (user.role === "ADMIN") throw ADMIN_PROTECTED() // also covers an admin targeting themselves

        if (user.status === status) return toUserView(user, new Date())

        const [updated] = await tx
            .update(users)
            .set({
                status,
                // Reactivating also lifts a login lockout, so the person can sign in at once.
                ...(status === "ACTIVE" ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
            })
            .where(eq(users.id, user.id))
            .returning()

        if (status === "SUSPENDED") {
            // Their access token stops working immediately (status is checked on every request);
            // this also ends the refresh tokens so they cannot get a new one.
            await tx
                .update(refreshTokensTable)
                .set({ revokedAt: new Date() })
                .where(and(eq(refreshTokensTable.userId, user.id), isNull(refreshTokensTable.revokedAt)))
        }

        await recordAudit(tx, {
            actorId,
            action: "USER_STATUS_CHANGED",
            targetType: "USER",
            targetId: user.id,
            before: { status: user.status },
            after: { status },
        })
        return toUserView(updated!, new Date())
    })
}

export async function setUserRole(actorId: string, userId: string, role: "USER" | "MANAGER") {
    return db.transaction(async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update")
        if (!user) throw new NotFoundError("User not found")
        if (user.role === "ADMIN") throw ADMIN_PROTECTED()

        if (user.role === role) return toUserView(user, new Date())

        // A manager sees customer details, so only a real, verified, active person can become one.
        if (role === "MANAGER") {
            if (!user.isVerified) {
                throw new ConflictError("This user has not verified their email yet", "USER_NOT_VERIFIED")
            }
            if (user.status !== "ACTIVE") {
                throw new ConflictError("This user is suspended", "USER_SUSPENDED")
            }
        }

        const [updated] = await tx.update(users).set({ role }).where(eq(users.id, user.id)).returning()
        await recordAudit(tx, {
            actorId,
            action: "USER_ROLE_CHANGED",
            targetType: "USER",
            targetId: user.id,
            before: { role: user.role },
            after: { role },
        })
        return toUserView(updated!, new Date())
    })
}
