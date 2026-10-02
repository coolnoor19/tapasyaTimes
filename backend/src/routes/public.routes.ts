import express from "express"
import { publicOverviewHandler } from "../controllers/public.controller.js"

export const router = express.Router()

// No authentication on purpose: this is what the public landing page shows.
// Keep it to read-only data that is safe for anyone on the internet to see.
router.get('/overview', publicOverviewHandler)
