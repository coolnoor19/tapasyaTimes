import { createApp} from "./app"

async function startServer() {
    const app = createApp();

    const PORT = process.env.PORT || 3005;
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

}

startServer();