const UNIQUE_VIOLATION = "23505"

interface PgErrorLike {
    code?: string
    constraint?: string
    cause?: unknown
}

// Drizzle wraps driver errors, so the Postgres error may be on `err` or `err.cause`.
function findPgError(err: unknown): PgErrorLike | undefined {
    let current: unknown = err
    for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
        const candidate = current as PgErrorLike
        if (typeof candidate.code === "string") return candidate
        current = candidate.cause
    }
    return undefined
}

// Postgres error code of `err` (e.g. "40P01" for a deadlock), if it is a database error.
export function getPgErrorCode(err: unknown): string | undefined {
    return findPgError(err)?.code
}

// Returns the violated constraint name if `err` is a unique violation, else undefined.
export function getUniqueViolation(err: unknown): { constraint: string | undefined } | undefined {
    const pgError = findPgError(err)
    if (pgError?.code !== UNIQUE_VIOLATION) return undefined
    return { constraint: pgError.constraint }
}
