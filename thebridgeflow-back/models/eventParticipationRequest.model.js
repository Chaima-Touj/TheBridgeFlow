import mongoose from "mongoose";
import { PARTICIPATION_STATUSES, STUDY_LEVELS } from "../utils/validateEventParticipationRequest.js";

// Origine d'une demande : formulaire « Participer à nos événements », ou
// ancien message du formulaire de contact repris par la migration
// (services/legacyContactMigration.service.js).
export const PARTICIPATION_SOURCES = ["form", "contact"];
const fromForm = function () { return this.source !== "contact"; };

// Demande de participation envoyée depuis le formulaire « Participer à nos
// événements » (pages Contact). La date de soumission est createdAt.
const eventParticipationRequestSchema = new mongoose.Schema({
  source: { type: String, enum: PARTICIPATION_SOURCES, default: "form" },
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  // Un ancien message ne contenait qu'un nom complet : nom, téléphone,
  // établissement et niveau n'y sont pas toujours renseignés.
  lastName: { type: String, required: fromForm, trim: true, maxlength: 80, default: "" },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: fromForm, trim: true, maxlength: 32, default: "" },
  university: { type: String, required: fromForm, trim: true, maxlength: 160, default: "" },
  studyLevel: { type: String, enum: STUDY_LEVELS, required: fromForm },
  // Ancien message du site : objet et contenu d'origine.
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
  // Empreinte anti-doublon (participationDedupKey) : présente uniquement tant
  // que la demande est ouverte (Nouveau / Contacté). Jamais renvoyée au client.
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
