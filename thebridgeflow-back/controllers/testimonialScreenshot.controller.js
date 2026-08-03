import TestimonialScreenshot from "../models/testimonialScreenshot.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { normalizeDriveUrl, isBase64Image } from "../utils/driveHelper.js";

// imageUrl peut être un lien Google Drive (normalisé), une image base64
// (compression côté client, voir imageCompression.js) ou un chemin statique
// existant (ex: /images/feedback-thumbs/img1.jpg, issu de la migration) —
// normalizeDriveUrl renvoie ce dernier inchangé (pas un lien Drive).
function normalizeImage(image) {
  return isBase64Image(image) ? image : normalizeDriveUrl(image, "image");
}

// GET /api/testimonial-screenshots — public, triée par ordre d'affichage.
export const getAllTestimonialScreenshots = asyncHandler(async (req, res) => {
  const screenshots = await TestimonialScreenshot.find().sort({ order: 1, createdAt: 1 }).select("-__v");
  res.json(screenshots);
});

/* ── POST /api/testimonial-screenshots ────────────────────────────────────────
   Réservé admin. */
export const addTestimonialScreenshot = asyncHandler(async (req, res) => {
  const { imageUrl, name, order } = req.body;
  if (!imageUrl) {
    const err = new Error("Champ requis manquant : imageUrl.");
    err.statusCode = 400;
    throw err;
  }

  const screenshot = await TestimonialScreenshot.create({
    imageUrl: normalizeImage(imageUrl),
    name:     name || "",
    order:    order !== undefined ? order : 0,
  });

  res.status(201).json(screenshot);
});

/* ── PATCH /api/testimonial-screenshots/:id ───────────────────────────────────
   Réservé admin. */
export const updateTestimonialScreenshot = asyncHandler(async (req, res) => {
  const screenshot = await TestimonialScreenshot.findById(req.params.id);
  if (!screenshot) {
    const err = new Error("Capture introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const { imageUrl, name, order } = req.body;
  if (imageUrl !== undefined) screenshot.imageUrl = normalizeImage(imageUrl);
  if (name !== undefined)     screenshot.name = name;
  if (order !== undefined)    screenshot.order = order;

  await screenshot.save();
  res.json(screenshot);
});

/* ── DELETE /api/testimonial-screenshots/:id ──────────────────────────────────
   Réservé admin. */
export const deleteTestimonialScreenshot = asyncHandler(async (req, res) => {
  const screenshot = await TestimonialScreenshot.findById(req.params.id);
  if (!screenshot) {
    const err = new Error("Capture introuvable.");
    err.statusCode = 404;
    throw err;
  }
  await screenshot.deleteOne();
  res.json({ message: "Capture supprimée.", id: screenshot._id });
});
