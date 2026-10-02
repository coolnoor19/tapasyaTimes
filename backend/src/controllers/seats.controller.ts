import type { NextFunction, Request, Response } from "express"
import { getSeatAvailability } from "../services/availability.service.js"

export async function availabilityHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        // Set by validateQuery
        const query = res.locals.query as { dates: string[]; timeSlotId: string }
        // Availability changes with every booking, so it must never be cached.
        res.set("Cache-Control", "no-store")
        res.status(200).json(await getSeatAvailability(query))
    } catch (err) {
        next(err)
    }
}
