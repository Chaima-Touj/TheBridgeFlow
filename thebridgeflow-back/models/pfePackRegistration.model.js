import mongoose from "mongoose";
import { REQUEST_STATUSES } from "../utils/requestStatuses.js";

const pfePackRegistrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, trim: true, maxlength: 32 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
  university: { type: String, required: true, trim: true, maxlength: 160 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  technologies: { type: [String], required: true, validate: [(values) => values.length >= 2, "Indiquez au moins deux technologies."] },
  locationMode: { type: String, enum: ["remote", "onsite"], required: true },
  preferredLocation: { type: String, trim: true, maxlength: 200, default: "" },
  subject: { type: String, trim: true, maxlength: 3000 },
  consentConfirmed: { type: Boolean, required: true, validate: [(value) => value === true, "Confirmez votre accord avant l’envoi."] },
  // Suivi par l'équipe (modifié uniquement par un administrateur). Les
  // demandes enregistrées avant l'ajout du suivi n'ont pas de statut : elles
  // sont traitées comme « new » (voir serializePfePackRegistration).
  status: { type: String, enum: REQUEST_STATUSES, default: "new" },
  statusUpdatedAt: { type: Date, default: null },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

pfePackRegistrationSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("PfePackRegistration", pfePackRegistrationSchema);
