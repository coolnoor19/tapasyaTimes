import type { NextFunction, Request, Response } from "express"

export interface SlowRequest {
    method: string
    path: string
    status: number
    ms: number
    requestId: string | undefined
}

// Answers "is the API slow, and where?" in two places:
//  - Server-Timing header on EVERY response (browser DevTools > Network > Timing shows it as "Server Timing"). Compare it with
//    the total time of the request: server time high = the backend or database is slow, server time low but total high = the
//    network or the proxy is slow.
//  - one `warn` log line for every request slower than `slowMs`, with the request id (X-Request-Id) so it can be found in the log.
// The query string is left out of the log on purpose: it can hold a customer's name, email or phone (?search=...).
export function requestTiming(options: { slowMs: number; onSlow: (request: SlowRequest) => void }) {
    return (req: Request, res: Response, next: NextFunction) => {
        const start = process.hrtime.bigint()
        const elapsedMs = () => Number(process.hrtime.bigint() - start) / 1_000_000

        // Headers must be set before the first byte goes out, and every way of answering (json, send, end) passes writeHead.
        const writeHead = res.writeHead.bind(res)
        res.writeHead = ((...args: Parameters<typeof res.writeHead>) => {
            if (!res.headersSent) res.setHeader("Server-Timing", `total;dur=${elapsedMs().toFixed(1)}`)
            return writeHead(...args)
        }) as typeof res.writeHead

        res.once("finish", () => {
            const ms = elapsedMs()
            if (ms < options.slowMs) return
            const id = res.getHeader("X-Request-Id")
            options.onSlow({
                method: req.method,
                path: req.originalUrl.split("?")[0] ?? req.originalUrl,
                status: res.statusCode,
                ms: Math.round(ms),
                requestId: typeof id === "string" ? id : undefined,
            })
        })

        next()
    }
}
