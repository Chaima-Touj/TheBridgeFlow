import express from "express";
import rateLimit from "express-rate-limit";
import { authorize, protect, validateObjectId } from "../middleware/auth.middleware.js";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";
import {
  createParticipationRequest,
  listParticipationRequests,
  getParticipationRequest,
  updateParticipationStatus,
} from "../controllers/eventParticipationRequests.controller.js";

// /api/event-participation-requests — formulaire public « Participer à nos
// événements » + gestion des demandes par les administrateurs.
const router = express.Router();

// Formulaire public : plafond dédié par IP (comme l'inscription à la
// newsletter), en plus du reCAPTCHA et du limiteur global /api.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Trop de demandes envoyées. Réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});

router.post("/", submitLimiter, verifyRecaptcha, createParticipationRequest);
router.get("/", protect, authorize("admin"), listParticipationRequests);
router.get("/:id", protect, authorize("admin"), validateObjectId(), getParticipationRequest);
router.patch("/:id/status", protect, authorize("admin"), validateObjectId(), updateParticipationStatus);

export default router;
