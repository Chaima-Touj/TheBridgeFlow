import express from "express";
import { authorize, protect } from "../middleware/auth.middleware.js";
import { requireStudentPhone } from "../middleware/requireStudentPhone.middleware.js";
import {
  cancelEventRegistration,
  createEvent,
  deleteEvent,
  getAdminEvents,
  getAdminEventFeedbacks,
  getEventRegistrations,
  getMyEventFeedback,
  getPublishedEventFeedbacks,
  getEventSessionLink,
  getMyEventRegistrations,
  getPublicEvent,
  getPublicEvents,
  registerForEvent,
  createEventFeedback,
  setEventFeedbackPublication,
  updateEvent,
} from "../controllers/events.controller.js";

const router = express.Router();

router.get("/", getPublicEvents);
router.get("/my-registrations", protect, authorize("étudiant"), getMyEventRegistrations);
router.get("/feedbacks/admin", protect, authorize("admin"), getAdminEventFeedbacks);
router.patch("/feedbacks/:feedbackId/publication", protect, authorize("admin"), setEventFeedbackPublication);
router.get("/admin", protect, authorize("admin"), getAdminEvents);
router.post("/", protect, authorize("admin"), createEvent);
router.get("/:id/registrations", protect, authorize("admin"), getEventRegistrations);
router.get("/:id/session-link", protect, getEventSessionLink);
router.get("/:id/feedbacks", getPublishedEventFeedbacks);
router.get("/:id/my-feedback", protect, authorize("étudiant"), getMyEventFeedback);
router.post("/:id/feedbacks", protect, authorize("étudiant"), createEventFeedback);
router.post("/:id/registrations", protect, authorize("étudiant"), requireStudentPhone, registerForEvent);
router.delete("/:id/registrations", protect, authorize("étudiant"), cancelEventRegistration);
router.delete("/:id", protect, authorize("admin"), deleteEvent);
router.patch("/:id", protect, authorize("admin"), updateEvent);
router.get("/:id", getPublicEvent);

export default router;
