import mongoose from "mongoose";

// Même structure que les champs média du modèle Formation (trailer, weeks,
// videos) : url = lien normalisé (/preview) utilisé pour la lecture,
// driveUrl = lien brut collé par l'admin, conservé pour référence.
const mediaSchema = new mongoose.Schema({
  url:       { type: String, default: "" },
  provider:  { type: String, enum: ["cloudinary", "google_drive"], default: "google_drive" },
  driveUrl:  { type: String, default: "" },
  thumbnail: { type: String, default: "" },
}, { _id: false });

// Document singleton — un seul document existe jamais dans cette collection
// (voir getOrCreateSettings dans siteSettings.controller.js).
const siteSettingsSchema = new mongoose.Schema({
  actionVideo: { type: mediaSchema, default: () => ({}) },
}, { timestamps: true });

export default mongoose.model("SiteSettings", siteSettingsSchema);
