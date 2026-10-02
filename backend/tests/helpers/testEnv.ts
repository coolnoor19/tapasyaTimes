import "dotenv/config"

// Integration tests wipe tables, so they must never run against the dev database.
// Returns the test database URL, or undefined when none is configured
// (integration tests are then skipped and unit tests still run).
export function resolveTestDatabaseUrl(): string | undefined {
    const testUrl = process.env.TEST_DATABASE_URL?.trim() || undefined
    const devUrl = process.env.DATABASE_URL?.trim() || undefined

    if (testUrl && testUrl === devUrl) {
        throw new Error(
            "TEST_DATABASE_URL is the same as DATABASE_URL. Tests delete data, so use a separate database (e.g. a Neon branch).",
        )
    }
    return testUrl
}
