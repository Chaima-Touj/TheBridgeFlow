import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { getSettings, updateSettings } from "../controllers/siteSettings.controller.js";

const router = express.Router();

// ─── Lecture — publique (landing page) ──────────────────────────────────────
router.get("/", getSettings);

// ─── Écriture — réservée à l'admin ──────────────────────────────────────────
router.patch("/", protect, authorize("admin"), updateSettings);

export default router;
