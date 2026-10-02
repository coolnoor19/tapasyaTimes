import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { resolveTestDatabaseUrl } from "./helpers/testEnv.js"

// Runs once before all tests: bring the test database up to the latest schema.
export default async function globalSetup() {
    const url = resolveTestDatabaseUrl()
    if (!url) {
        console.warn("\n[tests] TEST_DATABASE_URL is not set: integration tests will be skipped.\n")
        return
    }

    const pool = new Pool({ connectionString: url })
    try {
        await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" })
    } finally {
        await pool.end()
    }
}
