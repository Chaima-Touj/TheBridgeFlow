import mongoose from "mongoose";

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
}, { timestamps: true });

export default mongoose.model("PfePackRegistration", pfePackRegistrationSchema);
