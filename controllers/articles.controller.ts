import { Request, Response } from "express";
import mongoose from "mongoose";
import Article from "../models/article.model.js";
import { normalizeText } from "../utils/normalizeText.js";

function parsePagination(query: Request["query"]) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

export async function getArticles(req: Request, res: Response) {
    try {
        const { page, limit, skip } = parsePagination(req.query);

        const query: Record<string, unknown> = {};
        if (req.query.topic) {
            query.normalizedTopic = normalizeText(String(req.query.topic));
        }
        if (req.query.source) {
            query["source.name"] = new RegExp(`^${String(req.query.source)}$`, "i");
        }
        if (req.query.sentiment) {
            query.sentiment = String(req.query.sentiment);
        }

        const sort = String(req.query.sort || "-publishedAt");

        const [items, total] = await Promise.all([
            Article.find(query).sort(sort).skip(skip).limit(limit).lean(),
            Article.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: items
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch articles",
            error: (error as Error).message
        });
    }
}

export async function getArticleById(req: Request, res: Response) {
    try {
        const id = String(req.params.id || "");
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid article id" });
        }

        const article = await Article.findById(id).lean();
        if (!article) {
            return res.status(404).json({ success: false, message: "Article not found" });
        }

        return res.status(200).json({ success: true, data: article });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch article",
            error: (error as Error).message
        });
    }
}
