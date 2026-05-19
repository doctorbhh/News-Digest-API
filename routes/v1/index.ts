import { Router } from "express";
import articlesRouter from "./articles.routes.js";
import clustersRouter from "./clusters.routes.js";
import topicsRouter from "./topics.routes.js";

const router = Router();

router.use("/articles", articlesRouter);
router.use("/clusters", clustersRouter);
router.use("/topics", topicsRouter);

// ── Assignment-spec aliases ───────────────────────────────
router.use("/digest", clustersRouter);
router.use("/topic", topicsRouter);

export default router;
