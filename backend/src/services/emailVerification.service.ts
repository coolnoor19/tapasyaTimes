import { randomUUID } from "node:crypto"
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import { usersTable, verificationTokensTable as tokens } from "../db/schema.js"
import { sendMail } from "../mail/mailer.js"
import { verifyEmailTemplate } from "../mail/templates/verifyEmail.js"
import { BadRequestError } from "../utils/errors/BadRequestError.js"
import { generateOtp, hashOtp, safeEqualHex } from "../utils/otp.util.js"

// Security settings (not business rules): short life, few guesses, no spamming.
const OTP_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_MS = 60_000

const PURPOSE = "EMAIL_VERIFICATION" as const

interface VerificationRecipient {
    id: string
    firstName: string
    email: string
}

// Creates a fresh code (invalidating older ones) and emails it.
export async function sendVerificationCode(user: VerificationRecipient): Promise<void> {
    const code = generateOtp()
    const tokenId = randomUUID()

    await db.transaction(async (tx) => {
        // Only the newest code may work. "Used" here also means "superseded".
        await tx
            .update(tokens)
            .set({ usedAt: new Date() })
            .where(and(eq(tokens.userId, user.id), eq(tokens.purpose, PURPOSE), isNull(tokens.usedAt)))

        await tx.insert(tokens).values({
            id: tokenId,
            userId: user.id,
            tokenHash: hashOtp(user.id, tokenId, code),
            purpose: PURPOSE,
            expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
        })
    })

    await sendMail({
        to: user.email,
        ...verifyEmailTemplate({ firstName: user.firstName, code, expiresInMinutes: OTP_TTL_MINUTES }),
    })
}

// Every failure returns the same message so the endpoint cannot be used to
// discover which emails are registered or what state their code is in.
const invalidCode = () => new BadRequestError("Invalid or expired code")

export async function verifyEmailCode(email: string, code: string): Promise<void> {
    const [user] = await db
        .select({ id: usersTable.id, isVerified: usersTable.isVerified })
        .from(usersTable)
        .where(eq(usersTable.email, email))

    if (!user || user.isVerified) throw invalidCode()

    const now = new Date()
    const [latest] = await db
        .select({ id: tokens.id })
        .from(tokens)
        .where(and(eq(tokens.userId, user.id), eq(tokens.purpose, PURPOSE), isNull(tokens.usedAt), gt(tokens.expiresAt, now)))
        .orderBy(desc(tokens.createdAt))
        .limit(1)

    if (!latest) throw invalidCode()

    // Spend one attempt BEFORE comparing. The update is atomic, so even many
    // parallel guesses can never exceed MAX_ATTEMPTS in total.
    const [claimed] = await db
        .update(tokens)
        .set({ attempts: sql`${tokens.attempts} + 1` })
        .where(and(eq(tokens.id, latest.id), isNull(tokens.usedAt), gt(tokens.expiresAt, now), lt(tokens.attempts, MAX_ATTEMPTS)))
        .returning({ id: tokens.id, tokenHash: tokens.tokenHash })

    if (!claimed || !safeEqualHex(claimed.tokenHash, hashOtp(user.id, claimed.id, code))) {
        throw invalidCode()
    }

    await db.transaction(async (tx) => {
        await tx.update(tokens).set({ usedAt: new Date() }).where(eq(tokens.id, claimed.id))
        await tx.update(usersTable).set({ isVerified: true }).where(eq(usersTable.id, user.id))
    })
}

// Silently does nothing for unknown, already-verified or suspended accounts,
// and when a code was sent less than a minute ago.
export async function resendVerificationCode(email: string): Promise<void> {
    const [user] = await db
        .select({
            id: usersTable.id,
            firstName: usersTable.firstName,
            email: usersTable.email,
            isVerified: usersTable.isVerified,
            status: usersTable.status,
        })
        .from(usersTable)
        .where(eq(usersTable.email, email))

    if (!user || user.isVerified || user.status !== "ACTIVE") return

    const [lastSent] = await db
        .select({ createdAt: tokens.createdAt })
        .from(tokens)
        .where(and(eq(tokens.userId, user.id), eq(tokens.purpose, PURPOSE)))
        .orderBy(desc(tokens.createdAt))
        .limit(1)

    if (lastSent && Date.now() - lastSent.createdAt.getTime() < RESEND_COOLDOWN_MS) return

    await sendVerificationCode(user)
}
