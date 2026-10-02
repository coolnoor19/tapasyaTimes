import pino from "pino"
import { env } from "../config/env.js"

export const logger = pino({
    level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
    // Never write credentials to logs, even by accident.
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'res.headers["set-cookie"]',
            "*.password",
            "*.passwordHash",
        ],
        censor: "[redacted]",
    },
})
