import type { db } from "./index.js"

// The object Drizzle passes to db.transaction(async (tx) => ...)
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
