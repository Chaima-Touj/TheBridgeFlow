import User       from "../models/users.model.js";
import Formation  from "../models/formation.model.js";
import Offer      from "../models/offers.model.js";
import asyncHandler from "../utils/asyncHandler.js";

/* ── GET /api/stats — chiffres publics affichés sur la Landing Page ────────────
   Endpoint public (pas d'auth) : uniquement des compteurs agrégés, aucune
   donnée nominative.                                                         */
export const getPublicStats = asyncHandler(async (req, res) => {
  const [formationsCount, studentsCount, activeOffersCount] = await Promise.all([
    Formation.countDocuments({}),
    User.countDocuments({ role: "étudiant" }),
    Offer.countDocuments({ isActive: true }),
  ]);

  res.json({
    formationsCount,
    studentsCount,
    satisfactionRate: 100, // pas de données d'enquête de satisfaction en base — valeur fixe assumée
    activeOffersCount,
  });
});
