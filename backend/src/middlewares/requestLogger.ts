import { randomUUID } from "node:crypto"
import { pinoHttp } from "pino-http"
import { logger } from "../utils/logger.js"

// Logs one line per request. Request bodies are not logged (they hold passwords).
export const requestLogger = pinoHttp({
    logger,
    // Always generate our own id; an id sent by the client is not trusted.
    genReqId: (_req, res) => {
        const id = randomUUID()
        res.setHeader("X-Request-Id", id)
        return id
    },
})
