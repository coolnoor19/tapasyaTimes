import { getTableName, is } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { db } from "../../src/db/index.js"
import * as schema from "../../src/db/schema.js"

// True when a separate TEST_DATABASE_URL is configured (see tests/setup.ts).
export const hasTestDb = process.env.HAS_TEST_DB === "1"

const TABLES = (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => `"${getTableName(table)}"`)

// The app sends some work in the background (e.g. the verification email after
// registration). Wait until no other connection is mid-query, so cleanup does
// not collide with the previous test's leftovers.
async function waitForIdleConnections(timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const { rows } = await db.execute<{ busy: number }>(
            sql`SELECT count(*)::int AS busy FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid() AND state <> 'idle'`,
        )
        if (rows[0]?.busy === 0) return
        await new Promise((resolve) => setTimeout(resolve, 25))
    }
}

// Empties every table. Only ever called against the test database.
export async function resetDb() {
    await waitForIdleConnections()
    for (let attempt = 1; ; attempt++) {
        try {
            await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`))
            return
        } catch (err) {
            // 40P01 = deadlock with a straggling background query; just try again
            if (pgCode(err) !== "40P01" || attempt >= 5) throw err
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
    }
}

export async function closeDb() {
    await db.$client.end()
}

// Postgres error code (e.g. 23505 unique, 23514 check), looking through Drizzle's wrapper.
export function pgCode(err: unknown): string | undefined {
    let current: unknown = err
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
        const { code, cause } = current as { code?: unknown; cause?: unknown }
        if (typeof code === "string") return code
        current = cause
    }
    return undefined
}
