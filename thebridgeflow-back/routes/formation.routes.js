import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { uploadVideoThumbnail } from "../middleware/upload.middleware.js";
import {
  getAllFormations,
  getFormationsTechMap,
  getFormationBySlug,
  getFormationById,
  createFormation,
  updateFormationInfo,
  deleteFormation,
  patchFormationWeeks,
  patchFormationSupervision,
  patchFormationTrailer,
  patchFormationVideos,
  uploadFormationVideoThumbnail,
  addReview,
  updateReview,
  deleteReview,
} from "../controllers/formation.controller.js";

const router = express.Router();

// ─── Lecture — publique ─────────────────────────────────────────────────────
router.get("/",                           getAllFormations);
router.get("/tech-map",                   getFormationsTechMap);
router.get("/slug/:slug",                 getFormationBySlug);

// ─── Écriture — réservée à l'admin ──────────────────────────────────────────
router.post("/",                          protect, authorize("admin"), createFormation);
router.patch("/slug/:slug/weeks",         protect, authorize("admin"), patchFormationWeeks);
router.patch("/slug/:slug/supervision",   protect, authorize("admin"), patchFormationSupervision);
router.patch("/slug/:slug/videos",        protect, authorize("admin"), patchFormationVideos);
router.post("/upload-thumbnail",          protect, authorize("admin"), uploadVideoThumbnail, uploadFormationVideoThumbnail);
router.patch("/:id/trailer",              protect, authorize("admin"), patchFormationTrailer);
router.patch("/:id",                      protect, authorize("admin"), updateFormationInfo);
router.delete("/:id",                     protect, authorize("admin"), deleteFormation);

// ─── Avis (reviews) — CRUD par avis, réservé admin ──────────────────────────
router.post("/:formationId/reviews",              protect, authorize("admin"), addReview);
router.patch("/:formationId/reviews/:reviewId",   protect, authorize("admin"), updateReview);
router.delete("/:formationId/reviews/:reviewId",  protect, authorize("admin"), deleteReview);

router.get("/:id",                        getFormationById);

export default router;
