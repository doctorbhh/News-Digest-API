import { Router } from "express";
import { getClustersByTopic, getTopics } from "../../controllers/clusters.controller.js";

const router = Router();

router.get("/", getTopics);
router.get("/:topic/clusters", getClustersByTopic);

export default router;
