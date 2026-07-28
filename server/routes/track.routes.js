import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";
import PageVisit from "../models/pageVisit.model.js";
import VideoView from "../models/videoView.model.js";

const router = express.Router();

/**
 * POST /api/track/page-visit
 * Enregistre une visite de page.
 * Accessible sans authentification stricte — si un token JWT valide est présent
 * dans le header Authorization, le userId est associé à la visite.
 */
router.post("/page-visit", asyncHandler(async (req, res) => {
  const { path } = req.body;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ message: "Le champ 'path' est requis." });
  }

  let userId = undefined;

  // Tentative d'identification de l'utilisateur si un token est présent
  const authHeader = req.headers.authorization || "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.id) {
        userId = decoded.id;
      }
    } catch {
      // Token invalide ou expiré — on ignore, la visite reste anonyme
    }
  }

  await PageVisit.create({ userId, path });

  res.status(201).json({ message: "Visite enregistrée." });
}));

/**
 * POST /api/track/video-view
 * Enregistre une vue de vidéo (preview formation, témoignage, promo Hero).
 * Accessible sans authentification stricte — si un token JWT valide est présent
 * dans le header Authorization, le userId est associé à la vue.
 */
router.post("/video-view", asyncHandler(async (req, res) => {
  const { videoIdentifier, videoLabel } = req.body;

  if (!videoIdentifier || typeof videoIdentifier !== "string") {
    return res.status(400).json({ message: "Le champ 'videoIdentifier' est requis." });
  }
  if (!videoLabel || typeof videoLabel !== "string") {
    return res.status(400).json({ message: "Le champ 'videoLabel' est requis." });
  }

  let userId = undefined;

  // Tentative d'identification de l'utilisateur si un token est présent
  const authHeader = req.headers.authorization || "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.id) {
        userId = decoded.id;
      }
    } catch {
      // Token invalide ou expiré — on ignore, la vue reste anonyme
    }
  }

  await VideoView.create({ userId, videoIdentifier, videoLabel });

  res.status(201).json({ message: "Vue vidéo enregistrée." });
}));

export default router;

