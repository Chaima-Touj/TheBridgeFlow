import express from "express";
// Importer les fonctions du contrôleur et le middleware de protection
import { chat, getUserContext, recommendations } from "../controllers/ai.controller.js";
// Importer le middleware de protection pour sécuriser les routes
import { protect } from "../middleware/auth.middleware.js";
// Créer un routeur Express
const router = express.Router();
// Définir les routes pour l'API AI avec protection JWT
router.get("/user-context",          protect, getUserContext);
router.post("/chat",                 protect, chat);
router.post("/recommendations",      protect, recommendations);
// Exporter le routeur pour l'utiliser dans l'application principale
export default router;
