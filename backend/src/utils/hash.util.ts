import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

export async function hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

export async function comparePassword(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash)
}

// Compared against when the email is unknown or the account is locked, so those
// requests take as long as a real password check and timing reveals nothing.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", SALT_ROUNDS)
