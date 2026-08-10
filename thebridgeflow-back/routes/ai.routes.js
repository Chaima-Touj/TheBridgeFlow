import express from "express";
import { chat, getUserContext, recommendations } from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/user-context",          protect, getUserContext);
router.post("/chat",                 protect, chat);
router.post("/recommendations",      protect, recommendations);

export default router;
