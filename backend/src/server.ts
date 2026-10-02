import { env } from "./config/env.js"
import { db } from "./db/index.js"
import { createApp } from "./app.js"
import { logger } from "./utils/logger.js"

function startServer() {
    const app = createApp()

    const server = app.listen(env.PORT, () => logger.info(`Server started on port ${env.PORT}`))

    // Let in-flight requests finish and release DB connections on shutdown.
    const shutdown = (signal: string) => {
        logger.info(`${signal} received, shutting down`)
        server.close(() => {
            void db.$client.end().finally(() => process.exit(0))
        })
    }
    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
}

startServer()
