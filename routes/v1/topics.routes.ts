import { Router } from "express";
import { getClustersByTopic, getTopics } from "../../controllers/clusters.controller.js";

const router = Router();

router.get("/", getTopics);
router.get("/:topic/clusters", getClustersByTopic);

// Alias for /api/v1/topic/:name
router.get("/:name", (req, res) => {
    (req.params as any).topic = req.params.name;
    return getClustersByTopic(req, res);
});

export default router;
