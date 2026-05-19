import { Request, Response } from "express";
import User from "../models/user.model.js";
import { normalizeText } from "../utils/normalizeText.js";

/**
 * POST /api/v1/users/register
 * Creates a new user and returns the generated API key.
 */
export async function registerUser(_req: Request, res: Response) {
    try {
        const user = await User.create({});
        return res.status(201).json({
            success: true,
            message: "User registered. Save your API key — it cannot be recovered.",
            apiKey: user.apiKey,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to register user",
            error: (error as Error).message,
        });
    }
}

/**
 * GET /api/v1/users/me
 * Returns the authenticated user's profile and subscriptions.
 * Requires x-api-key header.
 */
export async function getMe(req: Request, res: Response) {
    const user = (req as any).user;
    return res.status(200).json({
        success: true,
        data: {
            subscribedTopics: user.subscribedTopics,
            createdAt: user.createdAt,
        },
    });
}

/**
 * PUT /api/v1/users/subscriptions
 * Replaces the user's subscribed topics with the provided array.
 * Body: { "topics": ["politics", "technology"] }
 * Requires x-api-key header.
 */
export async function updateSubscriptions(req: Request, res: Response) {
    try {
        const { topics } = req.body;

        if (!Array.isArray(topics)) {
            return res.status(400).json({
                success: false,
                message: "\"topics\" must be an array of strings",
            });
        }

        const normalized = topics
            .filter((t: unknown) => typeof t === "string" && t.trim())
            .map((t: string) => normalizeText(t));

        const user = await User.findByIdAndUpdate(
            (req as any).user._id,
            { subscribedTopics: normalized },
            { new: true }
        ).lean();

        return res.status(200).json({
            success: true,
            message: "Subscriptions updated",
            subscribedTopics: user?.subscribedTopics ?? [],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update subscriptions",
            error: (error as Error).message,
        });
    }
}
