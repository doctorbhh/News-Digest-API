import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fetchNews } from "./services/fetchNews.service.js";
import cron from "node-cron";
import { connectDB } from "./config/database.js";
import apiV1Router from "./routes/v1/index.js";
import { optionalAuth } from "./middlewares/auth.middleware.js";
import { fileURLToPath } from "url";
import { resolve, dirname, join } from "path";

dotenv.config();

export function createApp() {
    const app = express();

    app.use(cors());
    app.use(express.json());

    // Serve static frontend from public/
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    app.use(express.static(join(__dirname, "public")));

    app.get("/", (_req, res) => {
        res.sendFile(join(__dirname, "public", "index.html"));
    });

    // ── Rate limiting: 100 requests per 15 minutes per IP ──
    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: "Too many requests, please try again later.",
        },
    });

    app.use("/api/v1", apiLimiter, optionalAuth, apiV1Router);

    return app;
}

const PORT = process.env.PORT || 3000;

async function startServer() {
    const app = createApp();

    await connectDB();

    // run initial fetch once on startup
    await fetchNews();

    const schedule = process.env.CRON_SCHEDULE || "*/15 * * * *";
    try {
        cron.schedule(schedule, async () => {
            console.log(`Running scheduled fetchNews() - ${new Date().toISOString()}`);
            try {
                await fetchNews();
            } catch (err) {
                console.error("Scheduled fetchNews failed:", err);
            }
        });
        console.log(`Scheduled fetchNews with CRON '${schedule}'`);
    } catch (err) {
        console.error("Failed to schedule fetchNews:", err);
    }

    app.listen(PORT, () => {
        console.log(
            `Server running on port ${PORT}`
        );
    });
}

const currentFile = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(currentFile) === resolve(process.argv[1]);

if (isMain) {
    startServer();
}