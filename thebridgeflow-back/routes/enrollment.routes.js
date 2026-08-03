import express from "express";
import { protect, authorize, validateObjectId } from "../middleware/auth.middleware.js";
import {
  getMyEnrollments,
  getMyEnrollment,
  enroll,
  updateWeekStatus,
  getAllEnrollments,
  cancelEnrollment,
} from "../controllers/enrollment.controller.js";

const router = express.Router();

// ─── Consultation/annulation — réservé à l'admin ────────────────────────────
router.get("/admin",           protect, authorize("admin"), getAllEnrollments);
router.delete("/admin/:id",    protect, authorize("admin"), validateObjectId("id"), cancelEnrollment);

// Routes étudiant — nécessitent un token étudiant valide
router.use(protect);
router.use(authorize("étudiant"));

router.get("/",                                   getMyEnrollments);
router.get("/:formationId",                       getMyEnrollment);
router.post("/",                                  enroll);
router.patch("/:formationId/weeks/:weekNum",      updateWeekStatus);

export default router;
