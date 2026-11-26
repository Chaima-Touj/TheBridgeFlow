import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { startMediaUpload, appendMediaChunk } from "../controllers/mediaUpload.controller.js";
import { CHUNK_BYTES } from "../services/mediaUpload.service.js";

// Vidéos de témoignages envoyées depuis le PC (page admin Feedbacks).
const router = express.Router();

router.post("/", protect, authorize("admin"), startMediaUpload);
router.put(
  "/:uploadId",
  protect,
  authorize("admin"),
  // Morceau brut : lu seulement après l'authentification.
  express.raw({ type: "application/octet-stream", limit: CHUNK_BYTES + 1024 }),
  appendMediaChunk,
);

export default router;
