import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getSettings,
  updateSettings,
  addTestimonialVideo,
  updateTestimonialVideo,
  deleteTestimonialVideo,
} from "../controllers/siteSettings.controller.js";

const router = express.Router();

// ─── Lecture — publique (landing page) ──────────────────────────────────────
router.get("/", getSettings);

// ─── Écriture — réservée à l'admin ──────────────────────────────────────────
router.patch("/", protect, authorize("admin"), updateSettings);

// ─── Témoignages vidéo — CRUD par témoignage, réservé admin ────────────────
router.post("/testimonials",       protect, authorize("admin"), addTestimonialVideo);
router.patch("/testimonials/:id",  protect, authorize("admin"), updateTestimonialVideo);
router.delete("/testimonials/:id", protect, authorize("admin"), deleteTestimonialVideo);

export default router;
