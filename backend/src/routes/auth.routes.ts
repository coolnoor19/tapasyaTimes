import express from "express"

export const router = express.Router()


router.post('/register', (req, res) => {
    res.status(501).json({ message: "Not implemented" })
})

router.post('/login', (req, res) => {
    res.status(501).json({ message: "Not implemented" })
})
