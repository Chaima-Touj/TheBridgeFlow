import express from "express";
import { authorize, protect } from "../middleware/auth.middleware.js";
import { requireStudentPhone } from "../middleware/requireStudentPhone.middleware.js";
import {
  cancelEventRegistration,
  createEvent,
  getAdminEvents,
  getEventRegistrations,
  getMyEventRegistrations,
  getPublicEvent,
  getPublicEvents,
  registerForEvent,
  updateEvent,
} from "../controllers/events.controller.js";

const router = express.Router();

router.get("/", getPublicEvents);
router.get("/my-registrations", protect, authorize("étudiant"), getMyEventRegistrations);
router.get("/admin", protect, authorize("admin"), getAdminEvents);
router.post("/", protect, authorize("admin"), createEvent);
router.get("/:id/registrations", protect, authorize("admin"), getEventRegistrations);
router.post("/:id/registrations", protect, authorize("étudiant"), requireStudentPhone, registerForEvent);
router.delete("/:id/registrations", protect, authorize("étudiant"), cancelEventRegistration);
router.patch("/:id", protect, authorize("admin"), updateEvent);
router.get("/:id", getPublicEvent);

export default router;
