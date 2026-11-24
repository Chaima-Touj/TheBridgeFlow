import express from "express";
import rateLimit from "express-rate-limit";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";
import { createContactMessage } from "../controllers/eventParticipationRequests.controller.js";

// /api/contact-messages — formulaire de contact public (Accueil #contact et
// /contact). Les messages sont gérés dans Dashboard Admin → Messages du site
// (/api/event-participation-requests).
const router = express.Router();

// Plafond dédié par IP, en plus du reCAPTCHA et du limiteur global /api.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Trop de messages envoyés. Réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});

router.post("/", submitLimiter, verifyRecaptcha, createContactMessage);

export default router;
