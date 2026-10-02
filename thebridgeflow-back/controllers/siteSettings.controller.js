import SiteSettings from "../models/siteSettings.model.js";
import asyncHandler  from "../utils/asyncHandler.js";
import { normalizeDriveUrl, isBase64Image } from "../utils/driveHelper.js";

// Document singleton : un seul SiteSettings existe en base — créé à la
// première lecture/écriture s'il n'existe pas encore.
async function getOrCreateSettings() {
  let settings = await SiteSettings.findOne();
  if (!settings) settings = await SiteSettings.create({});
  return settings;
}

// GET /api/settings — public (lu par la landing page).
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json({
    _id: settings._id,
    actionVideo: settings.actionVideo,
    testimonialVideos: settings.testimonialVideos,
    communityAvatars: settings.communityAvatars,
    ceremonyEnabled: settings.ceremonyEnabled,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  });
});

/* ── PATCH /api/settings ──────────────────────────────────────────────────────
   Réservé admin. Normalise automatiquement actionVideo.driveUrl vers
   actionVideo.url (lien /preview) via normalizeDriveUrl, comme
   patchFormationTrailer pour Formation.                                     */
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const { actionVideo, ceremonyEnabled } = req.body;

  if (ceremonyEnabled !== undefined && typeof ceremonyEnabled !== "boolean") {
    const err = new Error("Le champ ceremonyEnabled doit être un booléen.");
    err.statusCode = 400;
    throw err;
  }

  if (actionVideo !== undefined) {
    const { driveUrl, provider, thumbnail } = actionVideo;

    if (driveUrl !== undefined) {
      settings.actionVideo.driveUrl = driveUrl;
      settings.actionVideo.url = normalizeDriveUrl(driveUrl, "video");
    }
    if (provider !== undefined)  settings.actionVideo.provider = provider;
    if (thumbnail !== undefined) settings.actionVideo.thumbnail = normalizeDriveUrl(thumbnail, "image");
  }

  if (ceremonyEnabled !== undefined) settings.ceremonyEnabled = ceremonyEnabled;

  await settings.save();
  res.json(settings);
});

/* ── POST /api/settings/testimonials ──────────────────────────────────────────
   Ajoute un témoignage vidéo (catégorie summer-camp/pfe/formation/unknown).
   Réservé admin. */
export const addTestimonialVideo = asyncHandler(async (req, res) => {
  const { driveUrl, provider, thumbnail, category } = req.body;
  if (!driveUrl) {
    const err = new Error("Champ requis manquant : driveUrl.");
    err.statusCode = 400;
    throw err;
  }

  const settings = await getOrCreateSettings();
  settings.testimonialVideos.push({
    driveUrl,
    url:       normalizeDriveUrl(driveUrl, "video"),
    provider:  provider || "google_drive",
    thumbnail: thumbnail ? (isBase64Image(thumbnail) ? thumbnail : normalizeDriveUrl(thumbnail, "image")) : "",
    category:  category || "unknown",
  });
  await settings.save();

  res.status(201).json(settings.testimonialVideos[settings.testimonialVideos.length - 1]);
});

/* ── PATCH /api/settings/testimonials/:id ─────────────────────────────────────
   Modifie un témoignage vidéo existant. Réservé admin. */
export const updateTestimonialVideo = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const testimonial = settings.testimonialVideos.id(req.params.id);
  if (!testimonial) {
    const err = new Error("Témoignage introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const { driveUrl, provider, thumbnail, category } = req.body;
  if (driveUrl !== undefined) {
    testimonial.driveUrl = driveUrl;
    testimonial.url = normalizeDriveUrl(driveUrl, "video");
  }
  if (provider !== undefined)  testimonial.provider = provider;
  if (thumbnail !== undefined) testimonial.thumbnail = isBase64Image(thumbnail) ? thumbnail : normalizeDriveUrl(thumbnail, "image");
  if (category !== undefined)  testimonial.category = category;

  await settings.save();
  res.json(testimonial);
});

/* ── DELETE /api/settings/testimonials/:id ────────────────────────────────────
   Supprime un témoignage vidéo. Réservé admin. */
export const deleteTestimonialVideo = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const testimonial = settings.testimonialVideos.id(req.params.id);
  if (!testimonial) {
    const err = new Error("Témoignage introuvable.");
    err.statusCode = 404;
    throw err;
  }

  testimonial.deleteOne();
  await settings.save();
  res.json({ message: "Témoignage supprimé.", id: req.params.id });
});
