import express from "express"

export function createApp() {
    const app = express()

    app.use(express.json({ limit: '100kb' }));

    app.use('/api/v1');

    return app
}