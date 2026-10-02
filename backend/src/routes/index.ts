import express from "express"
import { router as authRouter } from "./auth.routes.js"
import { router as seatsRouter } from "./seats.routes.js"
import { router as timeSlotsRouter } from "./timeSlots.routes.js"
import { router as bookingsRouter } from "./bookings.routes.js"

const router = express.Router()

router.get('/health' , (req ,res)=>{
    res.status(200).json({ message: "API is healthy" })
})

router.use('/auth', authRouter)
router.use('/seats', seatsRouter)
router.use('/time-slots', timeSlotsRouter)
router.use('/bookings', bookingsRouter)

export default router
