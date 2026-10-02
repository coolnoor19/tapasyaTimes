import type { NextFunction, Request, Response } from "express"
import { getPublicOverview } from "../services/publicOverview.service.js"

// Public pricing changes rarely, so browsers and CDNs may keep it for a minute.
// (A price change by an admin therefore shows up on the landing page within about a minute.)
const PUBLIC_CACHE = "public, max-age=60"

export async function publicOverviewHandler(_req: Request, res: Response, next: NextFunction) {
    try {
        const overview = await getPublicOverview()
        res.set("Cache-Control", PUBLIC_CACHE)
        res.status(200).json(overview)
    } catch (err) {
        next(err)
    }
}
