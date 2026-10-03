import express from "express"
import helmet from "helmet"
import cors from "cors"
import cookieParser from "cookie-parser"
import { env } from "./config/env.js"
import routes from "./routes/index.js"
import { requestLogger } from "./middlewares/requestLogger.js"
import { requestTiming } from "./middlewares/requestTiming.js"
import { logger } from "./utils/logger.js"
import { generalLimiter } from "./middlewares/rateLimiters.js"
import { notFound } from "./middlewares/notFound.js"
import { errorHandler } from "./middlewares/errorHandler.js"

export function createApp() {
    const app = express()

    app.set("trust proxy", env.TRUST_PROXY)

    app.use(helmet())
    app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }))
    app.use(requestLogger)
    app.use(requestTiming({ slowMs: env.SLOW_REQUEST_MS, onSlow: (request) => logger.warn(request, "slow request") }))
    app.use(generalLimiter)

    // The payment webhook (added later) needs the raw body for signature
    // verification, so it must be mounted before this JSON parser.
    app.use(express.json({ limit: "10kb" }))
    app.use(cookieParser())

    app.use('/api/v1', routes)

    app.use(notFound)
    app.use(errorHandler)

    return app
}
