import { Request, Response } from "express";
import mongoose from "mongoose";
import Cluster from "../models/cluster.model.js";
import Article from "../models/article.model.js";
import { normalizeText } from "../utils/normalizeText.js";

function parsePagination(query: Request["query"]) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

export async function getClusters(req: Request, res: Response) {
    try {
        const { page, limit, skip } = parsePagination(req.query);

        const query: Record<string, unknown> = {};
        if (req.query.topic) {
            query.normalizedTopic = normalizeText(String(req.query.topic));
        }
        if (req.query.sentiment) {
            query[`sentimentDistribution.${String(req.query.sentiment)}`] = { $gt: 0 };
        }

        const [items, total] = await Promise.all([
            Cluster.find(query).sort({ lastArticlePublishedAt: -1, updatedAt: -1 }).skip(skip).limit(limit).lean(),
            Cluster.countDocuments(query)
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
            message: "Failed to fetch clusters",
            error: (error as Error).message
        });
    }
}

export async function getClusterById(req: Request, res: Response) {
    try {
        const id = String(req.params.id || "");
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid cluster id" });
        }

        const cluster = await Cluster.findById(id).lean();
        if (!cluster) {
            return res.status(404).json({ success: false, message: "Cluster not found" });
        }

        const articles = await Article.find({ clusterId: cluster._id }).sort("-publishedAt").lean();

        return res.status(200).json({
            success: true,
            data: {
                cluster,
                articles
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cluster",
            error: (error as Error).message
        });
    }
}

export async function getTopics(_req: Request, res: Response) {
    try {
        const topics = await Cluster.distinct("topic");
        const sorted = topics.sort((a, b) => a.localeCompare(b));
        return res.status(200).json(sorted);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch topics",
            error: (error as Error).message
        });
    }
}

export async function getClustersByTopic(req: Request, res: Response) {
    try {
        const { page, limit, skip } = parsePagination(req.query);
        const topicParam = String(req.params.topic || "").replace(/-/g, " ");
        const normalizedTopic = normalizeText(topicParam);

        const query = { normalizedTopic };

        const [items, total] = await Promise.all([
            Cluster.find(query).sort({ lastArticlePublishedAt: -1, updatedAt: -1 }).skip(skip).limit(limit).lean(),
            Cluster.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            topic: normalizedTopic,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: items
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch topic clusters",
            error: (error as Error).message
        });
    }
}
