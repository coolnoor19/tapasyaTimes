import type { NextFunction, Request, RequestHandler, Response } from "express"

// Wraps a handler so any error goes to the error middleware, and reads the already-validated
// pieces: res.locals.params (URL), res.locals.query (query string), req.body (JSON).
// Staff data is sensitive and changes often, so every response is marked no-store.
export type Ctx = {
    actorId: string
    role: "ADMIN" | "MANAGER" | "USER"
    params: Record<string, string>
    query: Record<string, unknown>
    body: Record<string, unknown>
}

export function handle(fn: (ctx: Ctx, res: Response) => Promise<{ status?: number; body: unknown }>): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await fn(
                {
                    actorId: req.user!.id,
                    role: req.user!.role,
                    params: res.locals.params ?? {},
                    query: res.locals.query ?? {},
                    body: req.body ?? {},
                },
                res,
            )
            res.set("Cache-Control", "no-store")
            res.status(result.status ?? 200).json(result.body)
        } catch (err) {
            next(err)
        }
    }
}
