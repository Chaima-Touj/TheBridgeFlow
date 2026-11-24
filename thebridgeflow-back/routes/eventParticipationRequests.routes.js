import express from "express";
import { authorize, protect, validateObjectId } from "../middleware/auth.middleware.js";
import {
  listParticipationRequests,
  getParticipationRequest,
  updateParticipationStatus,
} from "../controllers/eventParticipationRequests.controller.js";

// /api/event-participation-requests — Dashboard Admin → Messages du site :
// messages du formulaire de contact (envoyés via /api/contact-messages) et
// demandes de participation aux événements, réservés aux administrateurs.
const router = express.Router();

router.get("/", protect, authorize("admin"), listParticipationRequests);
router.get("/:id", protect, authorize("admin"), validateObjectId(), getParticipationRequest);
router.patch("/:id/status", protect, authorize("admin"), validateObjectId(), updateParticipationStatus);

export default router;
