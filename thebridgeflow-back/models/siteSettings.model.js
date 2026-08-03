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

// Témoignage vidéo (carrousels landing "Summer Camp"/"Formation"/"PFE") —
// mêmes champs que mediaSchema + category, déduite du dossier/préfixe de
// fichier Drive d'origine à l'inventaire (voir inventory-landing.js).
const testimonialVideoSchema = new mongoose.Schema({
  url:       { type: String, default: "" },
  provider:  { type: String, enum: ["cloudinary", "google_drive"], default: "google_drive" },
  driveUrl:  { type: String, default: "" },
  thumbnail: { type: String, default: "" },
  category:  { type: String, enum: ["summer-camp", "pfe", "formation", "unknown"], default: "unknown" },
}, { _id: false });

// Avatar générique (pas un avatar par personne — voir le rapport
// d'inventaire pour le constat réel sur le dossier Drive "avatars").
const communityAvatarSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  url:  { type: String, default: "" },
}, { _id: false });

// Document singleton — un seul document existe jamais dans cette collection
// (voir getOrCreateSettings dans siteSettings.controller.js).
const siteSettingsSchema = new mongoose.Schema({
  actionVideo: { type: mediaSchema, default: () => ({}) },
  testimonialVideos: { type: [testimonialVideoSchema], default: [] },
  communityAvatars:  { type: [communityAvatarSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("SiteSettings", siteSettingsSchema);
