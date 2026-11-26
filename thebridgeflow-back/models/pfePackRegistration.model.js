import mongoose from "mongoose";
import { REQUEST_STATUSES } from "../utils/requestStatuses.js";
import { DEFAULT_PFE_PACK_PROGRAM, PFE_PACK_PROGRAMS } from "../utils/validatePfePackRegistration.js";

const pfePackRegistrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, trim: true, maxlength: 32 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
  university: { type: String, required: true, trim: true, maxlength: 160 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  technologies: { type: [String], required: true, validate: [(values) => values.length >= 1, "Indiquez au moins une technologie."] },
  locationMode: { type: String, enum: ["remote", "onsite"], required: true },
  preferredLocation: { type: String, trim: true, maxlength: 200, default: "" },
  subject: { type: String, trim: true, maxlength: 3000 },
  consentConfirmed: { type: Boolean, required: true, validate: [(value) => value === true, "Confirmez votre accord avant l’envoi."] },
  // Programme demandé : Pack PFE ou Summer Camp (même formulaire public). Les
  // demandes enregistrées avant l'ajout du champ n'en ont pas : elles sont
  // traitées comme « pfe-pack » (voir serializePfePackRegistration).
  program: { type: String, enum: PFE_PACK_PROGRAMS, default: DEFAULT_PFE_PACK_PROGRAM },
  // Suivi par l'équipe (modifié uniquement par un administrateur). Les
  // demandes enregistrées avant l'ajout du suivi n'ont pas de statut : elles
  // sont traitées comme « new » (voir serializePfePackRegistration).
  status: { type: String, enum: REQUEST_STATUSES, default: "new" },
  statusUpdatedAt: { type: Date, default: null },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

pfePackRegistrationSchema.index({ status: 1, createdAt: -1 });
pfePackRegistrationSchema.index({ program: 1, createdAt: -1 });

export default mongoose.model("PfePackRegistration", pfePackRegistrationSchema);
