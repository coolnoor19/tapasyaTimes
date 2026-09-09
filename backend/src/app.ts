import express from "express"
import routes from "./routes/index.js"

export function createApp() {
    const app = express()

    app.use(express.json());

    app.use('/api/v1', routes);

    return app
}