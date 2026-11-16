import mongoose from "mongoose";
import { TASK_TYPES, TASK_STATUSES } from "../utils/candidateFollowUp.js";

// Historique de suivi d'un étudiant (espace admin « Candidatures »).
// Partagé entre TOUS les administrateurs : aucune lecture n'est filtrée par
// createdBy, qui sert uniquement à la traçabilité et au droit de suppression.
const followUpTaskSchema = new mongoose.Schema(
  {
    // Toujours l'étudiant du dossier ouvert (paramètre d'URL vérifié côté
    // serveur), jamais une valeur envoyée dans le corps de la requête.
    studentId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Candidature concernée (facultative) — appartient forcément au même étudiant.
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", default: null },
    type:          { type: String, enum: TASK_TYPES, required: true },
    title:         { type: String, required: true, trim: true, maxlength: 160 },
    description:   { type: String, default: "", maxlength: 5000 },
    activityDate:  { type: Date, required: true, default: Date.now },
    dueDate:       { type: Date, default: null },
    status:        { type: String, enum: TASK_STATUSES, default: "pending" },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt:   { type: Date, default: null },
    completedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Clé d'idempotence générée par le formulaire : un double clic ou un
    // renvoi réseau ne crée jamais deux fois la même tâche.
    clientRequestId: { type: String },
  },
  { timestamps: true }
);

followUpTaskSchema.index({ studentId: 1, activityDate: -1 });
followUpTaskSchema.index({ status: 1, dueDate: 1 });
followUpTaskSchema.index({ applicationId: 1 });
followUpTaskSchema.index(
  { createdBy: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

export default mongoose.model("FollowUpTask", followUpTaskSchema);
