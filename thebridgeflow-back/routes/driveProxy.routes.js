import express from "express";
import { getDriveThumbnail } from "../controllers/driveProxy.controller.js";

const router = express.Router();

// ─── Lecture — publique ─────────────────────────────────────────────────────
router.get("/:fileId", getDriveThumbnail);

export default router;
