import express from "express";
import { protect, authorize, validateObjectId } from "../middleware/auth.middleware.js";
import {
  createRequest,
  getMyRequests,
  getAllRequests,
  acceptRequest,
  rejectRequest,
} from "../controllers/enrollmentRequest.controller.js";

const router = express.Router();

// ─── Consultation/traitement des demandes — réservé à l'admin ──────────────
router.get("/admin",         protect, authorize("admin"), getAllRequests);
router.patch("/:id/accept", protect, authorize("admin"), validateObjectId("id"), acceptRequest);
router.patch("/:id/reject", protect, authorize("admin"), validateObjectId("id"), rejectRequest);

// ─── Routes étudiant ─────────────────────────────────────────────────────────
router.use(protect);
router.use(authorize("étudiant"));

router.get("/",  getMyRequests);
router.post("/", createRequest);

export default router;
