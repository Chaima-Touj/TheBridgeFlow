import mongoose from "mongoose";
import { PARTICIPATION_STATUSES, STUDY_LEVEL_MAX_LENGTH } from "../utils/validateEventParticipationRequest.js";

// Origine : "form" = demande de participation (ancien formulaire « Participer
// à nos événements ») ; "contact" = message du formulaire de contact, envoyé
// depuis le site (POST /api/contact-messages) ou repris de l'ancienne
// collection par la migration (services/legacyContactMigration.service.js).
export const PARTICIPATION_SOURCES = ["form", "contact"];
const fromForm = function () { return this.source !== "contact"; };

// Messages du site : messages du formulaire de contact et demandes de
// participation aux événements. La date de réception est createdAt.
const eventParticipationRequestSchema = new mongoose.Schema({
  source: { type: String, enum: PARTICIPATION_SOURCES, default: "form" },
  // Un message du site ne contient qu'un nom complet (premier mot = firstName,
  // reste = lastName, 120 caractères au plus comme le formulaire) ; téléphone,
  // établissement et niveau n'y sont pas renseignés.
  firstName: { type: String, required: true, trim: true, maxlength: 120 },
  lastName: { type: String, required: fromForm, trim: true, maxlength: 120, default: "" },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: fromForm, trim: true, maxlength: 32, default: "" },
  university: { type: String, required: fromForm, trim: true, maxlength: 160, default: "" },
  // Facultatif, saisi librement (ex. « Licence 2 »). Les demandes plus
  // anciennes contiennent un code de l'ancienne liste (bac, bac1…bac5, other).
  studyLevel: { type: String, trim: true, maxlength: STUDY_LEVEL_MAX_LENGTH, default: "" },
  // Message du site : sujet et contenu.
  subject: { type: String, trim: true, maxlength: 180, default: "" },
  message: { type: String, trim: true, maxlength: 5000, default: "" },
  legacyContactId: { type: mongoose.Schema.Types.ObjectId },
  // Événement choisi (facultatif) + copie du titre/de la date : la demande
  // reste lisible même si l'événement est modifié ou supprimé ensuite.
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null },
  eventTitle: { type: String, trim: true, maxlength: 160, default: "" },
  eventStartsAt: { type: Date, default: null },
  // Option « Je souhaite être informé des prochains événements ».
  notifyUpcoming: { type: Boolean, default: false },
  // "general" | "upcoming" | "contact" | <id d'événement>.
  interestKey: { type: String, required: true, maxlength: 40 },
  // Empreinte anti-doublon (contactDedupKey, utils/validateContactMessage.js) :
  // uniquement pour un message envoyé par le formulaire de contact, tant qu'il
  // est ouvert (Nouveau / Contacté). Les demandes de participation plus
  // anciennes peuvent encore en avoir une. Jamais renvoyée au client.
  dedupKey: { type: String },
  status: { type: String, enum: PARTICIPATION_STATUSES, default: "new" },
  statusUpdatedAt: { type: Date, default: null },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

// Index de liste alignés sur le tri du tableau de bord { createdAt: -1, _id: -1 }.
eventParticipationRequestSchema.index({ createdAt: -1, _id: -1 });
eventParticipationRequestSchema.index({ status: 1, createdAt: -1, _id: -1 });
eventParticipationRequestSchema.index({ eventId: 1, createdAt: -1, _id: -1 });
eventParticipationRequestSchema.index(
  { dedupKey: 1 },
  { unique: true, partialFilterExpression: { dedupKey: { $type: "string" } } },
);
// Un ancien message n'est jamais importé deux fois (migration idempotente).
eventParticipationRequestSchema.index(
  { legacyContactId: 1 },
  { unique: true, partialFilterExpression: { legacyContactId: { $type: "objectId" } } },
);

export default mongoose.model("EventParticipationRequest", eventParticipationRequestSchema);
