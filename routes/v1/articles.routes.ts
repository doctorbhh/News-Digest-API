import { Router } from "express";
import { getArticleById, getArticles } from "../../controllers/articles.controller.js";

const router = Router();

router.get("/", getArticles);
router.get("/:id", getArticleById);

export default router;
