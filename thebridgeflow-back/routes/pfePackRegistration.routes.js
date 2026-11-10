import express from "express";
import { protect, authorize } from "../middleware/auth.middleware.js";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";
import {
  createPfePackRegistration,
  getPfePackRegistrations,
  getPfePackRegistrationById,
} from "../controllers/pfePackRegistration.controller.js";

const router = express.Router();

router.post("/", verifyRecaptcha, createPfePackRegistration);
router.get("/", protect, authorize("admin"), getPfePackRegistrations);
router.get("/:id", protect, authorize("admin"), getPfePackRegistrationById);

export default router;
