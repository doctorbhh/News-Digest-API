import { Request, Response, NextFunction } from "express";
import User from "../models/user.model.js";

/**
 * Middleware that optionally attaches the authenticated user to req.
 * If `x-api-key` header is present, it looks up the user.
 *   - If found  → sets (req as any).user and continues.
 *   - If invalid → 401.
 * If header is absent → continues without a user (public access).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (!apiKey) {
        return next();
    }

    User.findOne({ apiKey })
        .lean()
        .then((user) => {
            if (!user) {
                return _res.status(401).json({
                    success: false,
                    message: "Invalid API key",
                });
            }
            (req as any).user = user;
            next();
        })
        .catch(next);
}

/**
 * Middleware that *requires* a valid API key.
 * Returns 401 if the key is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: "Missing x-api-key header",
        });
    }

    User.findOne({ apiKey })
        .lean()
        .then((user) => {
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid API key",
                });
            }
            (req as any).user = user;
            next();
        })
        .catch(next);
}
