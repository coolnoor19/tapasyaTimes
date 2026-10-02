import express from "express"
import { authenticate } from "../middlewares/authenticate.js"
import { listTimeSlotsHandler } from "../controllers/timeSlots.controller.js"

export const router = express.Router()

router.get('/', authenticate, listTimeSlotsHandler)
