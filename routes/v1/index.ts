import { Router } from "express";
import articlesRouter from "./articles.routes.js";
import clustersRouter from "./clusters.routes.js";
import topicsRouter from "./topics.routes.js";

const router = Router();

router.use("/articles", articlesRouter);
router.use("/clusters", clustersRouter);
router.use("/topics", topicsRouter);

export default router;
