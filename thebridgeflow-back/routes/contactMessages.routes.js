import express from "express";
import { authorize, protect } from "../middleware/auth.middleware.js";
import {
  createContactSubmission,
  getContactSubmissions,
  markContactSubmissionRead,
} from "../controllers/contactMessages.controller.js";

const router = express.Router();

router.post("/", createContactSubmission);
router.get("/", protect, authorize("admin"), getContactSubmissions);
router.patch("/:id/read", protect, authorize("admin"), markContactSubmissionRead);

export default router;
