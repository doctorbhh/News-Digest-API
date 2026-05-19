import { Router } from "express";
import { registerUser, getMe, updateSubscriptions } from "../../controllers/users.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";

const router = Router();

// Public — anyone can register
router.post("/register", registerUser);

// Protected — requires x-api-key header
router.get("/me", requireAuth, getMe);
router.put("/subscriptions", requireAuth, updateSubscriptions);

export default router;
