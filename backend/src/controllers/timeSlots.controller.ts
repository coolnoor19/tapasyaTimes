import type { NextFunction, Request, Response } from "express"
import { listActiveTimeSlots } from "../services/timeSlots.service.js"

export async function listTimeSlotsHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        res.status(200).json({ timeSlots: await listActiveTimeSlots() })
    } catch (err) {
        next(err)
    }
}
