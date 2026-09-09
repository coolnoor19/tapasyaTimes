import express from "express"
import { router as authRouter } from "./auth.routes.js"

const router = express.Router()

router.get('/health' , (req ,res)=>{
    res.status(200).json({ message: "API is healthy" })
})

router.use('/auth', authRouter)

export default router
