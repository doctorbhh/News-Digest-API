import { Router } from "express";
import articlesRouter from "./articles.routes.js";
import clustersRouter from "./clusters.routes.js";
import topicsRouter from "./topics.routes.js";
import usersRouter from "./users.routes.js";

const router = Router();

router.use("/articles", articlesRouter);
router.use("/clusters", clustersRouter);
router.use("/topics", topicsRouter);
router.use("/users", usersRouter);

// ── Assignment-spec aliases ───────────────────────────────
router.use("/digest", clustersRouter);
router.use("/topic", topicsRouter);

export default router;
