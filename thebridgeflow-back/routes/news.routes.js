import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import {
  getAllNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
} from "../controllers/news.controller.js";

const router = express.Router();

// ─── Lecture — publique (Blog + Landing) ────────────────────────────────────
router.get("/", getAllNews);
router.get("/:id", getNewsById);

// ─── Écriture — réservée à l'admin ──────────────────────────────────────────
// image = lien Google Drive ou base64 (JSON, plus d'upload disque — voir
// news.controller.js). uploadNewsImage (upload.middleware.js) n'est plus
// utilisée ici mais reste définie, au cas où.
router.post("/",   protect, authorize("admin"), createNews);
router.put("/:id", protect, authorize("admin"), updateNews);
router.delete("/:id", protect, authorize("admin"), deleteNews);

export default router;
