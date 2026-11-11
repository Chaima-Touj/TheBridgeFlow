import express from "express";
import { getDriveVideo } from "../controllers/driveVideo.controller.js";

const router = express.Router();

// ─── Lecture — publique (vidéos témoignages uniquement, voir le contrôleur) ───
router.get("/:fileId", getDriveVideo);

export default router;
