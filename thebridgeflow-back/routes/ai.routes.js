import express from "express";
import { chat, getUserContext, recommendations, analyzeCv, generateMotivation } from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/user-context",          protect, getUserContext);
router.post("/chat",                 protect, chat);
router.post("/recommendations",      protect, recommendations);
router.post("/analyze-cv",           protect, analyzeCv);
router.post("/generate-motivation",  protect, generateMotivation);

export default router;
