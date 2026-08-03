import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getAllTestimonialScreenshots,
  addTestimonialScreenshot,
  updateTestimonialScreenshot,
  deleteTestimonialScreenshot,
} from "../controllers/testimonialScreenshot.controller.js";

const router = express.Router();

// ─── Lecture — publique ─────────────────────────────────────────────────────
router.get("/", getAllTestimonialScreenshots);

// ─── Écriture — réservée à l'admin ──────────────────────────────────────────
router.post("/",     protect, authorize("admin"), addTestimonialScreenshot);
router.patch("/:id",  protect, authorize("admin"), updateTestimonialScreenshot);
router.delete("/:id", protect, authorize("admin"), deleteTestimonialScreenshot);

export default router;
