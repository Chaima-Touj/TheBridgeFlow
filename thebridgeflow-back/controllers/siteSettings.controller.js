import SiteSettings from "../models/siteSettings.model.js";
import asyncHandler  from "../utils/asyncHandler.js";
import { normalizeDriveUrl, isBase64Image } from "../utils/driveHelper.js";
import { warmDriveVideoCache } from "../services/driveVideoCache.service.js";
import { mediaStore } from "../services/mediaUpload.service.js";

// Document singleton : un seul SiteSettings existe en base — créé à la
// première lecture/écriture s'il n'existe pas encore.
async function getOrCreateSettings() {
  let settings = await SiteSettings.findOne();
  if (!settings) settings = await SiteSettings.create({});
  return settings;
}

const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/* ── Vidéos envoyées depuis le PC (provider "upload") ─────────────────────────
   Le fichier a été publié au préalable par /api/media-uploads ; ici on vérifie
   seulement qu'il existe bien, puis on enregistre son adresse
   (/uploads/testimonials/<id>.<ext>). */
async function checkUploadedVideo(videoUpload) {
  if (typeof videoUpload !== "string" || !(await mediaStore.storedVideoExists(videoUpload))) {
    throw httpError("Vidéo envoyée introuvable : recommencez l'envoi depuis votre PC.");
  }
  return videoUpload;
}

const uploadedUrlOf = (media) => (media?.provider === "upload" && media.url ? media.url : "");

// Lien Drive : jamais le fournisseur "upload" (réservé aux fichiers envoyés).
const driveProvider = (provider) => (provider && provider !== "upload" ? provider : "google_drive");

function referencedUploads(settings) {
  return [settings?.actionVideo, ...(settings?.testimonialVideos || [])].map(uploadedUrlOf).filter(Boolean);
}

/* Supprime du disque les vidéos remplacées ou supprimées (si plus aucun
   témoignage ne les utilise), puis les envois abandonnés. Jamais bloquant :
   une erreur de nettoyage n'empêche pas la réponse. */
function releaseUploads(settings, urls = []) {
  const stillUsed = new Set(referencedUploads(settings));
  Promise.all(urls.filter((url) => url && !stillUsed.has(url)).map((url) => mediaStore.removeStoredVideo(url)))
    .then(() => mediaStore.cleanupOrphans(stillUsed))
    .catch((error) => console.warn("[media-uploads] Nettoyage impossible", { message: error.message }));
}

// Au démarrage du serveur : supprime les envois abandonnés (voir server.js).
export async function cleanupUnusedUploads() {
  const settings = await SiteSettings.findOne().select("actionVideo testimonialVideos").lean();
  return mediaStore.cleanupOrphans(referencedUploads(settings));
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
   patchFormationTrailer pour Formation. actionVideo.videoUpload : vidéo
   envoyée depuis le PC (remplace le lien Drive).                             */
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const { actionVideo, ceremonyEnabled } = req.body;

  if (ceremonyEnabled !== undefined && typeof ceremonyEnabled !== "boolean") {
    const err = new Error("Le champ ceremonyEnabled doit être un booléen.");
    err.statusCode = 400;
    throw err;
  }

  const previousUpload = uploadedUrlOf(settings.actionVideo);
  if (actionVideo !== undefined) {
    const { driveUrl, provider, thumbnail, videoUpload } = actionVideo;

    if (videoUpload) {
      if (videoUpload !== settings.actionVideo.url) settings.actionVideo.url = await checkUploadedVideo(videoUpload);
      settings.actionVideo.provider = "upload";
      settings.actionVideo.driveUrl = "";
    } else {
      if (driveUrl !== undefined) {
        settings.actionVideo.driveUrl = driveUrl;
        settings.actionVideo.url = normalizeDriveUrl(driveUrl, "video");
        settings.actionVideo.provider = driveProvider(provider);
      } else if (provider !== undefined && provider !== "upload") {
        settings.actionVideo.provider = provider;
      }
    }
    if (thumbnail !== undefined) settings.actionVideo.thumbnail = normalizeDriveUrl(thumbnail, "image");
  }

  if (ceremonyEnabled !== undefined) settings.ceremonyEnabled = ceremonyEnabled;

  await settings.save();
  if (previousUpload && previousUpload !== settings.actionVideo.url) releaseUploads(settings, [previousUpload]);
  res.json(settings);
});

/* ── POST /api/settings/testimonials ──────────────────────────────────────────
   Ajoute un témoignage vidéo (catégorie summer-camp/pfe/formation/unknown).
   Vidéo : lien Google Drive (driveUrl) ou vidéo envoyée depuis le PC
   (videoUpload). Réservé admin. */
export const addTestimonialVideo = asyncHandler(async (req, res) => {
  const { driveUrl, provider, thumbnail, category, videoUpload } = req.body;
  const cleanDriveUrl = typeof driveUrl === "string" ? driveUrl.trim() : "";
  if (!videoUpload && !cleanDriveUrl) {
    throw httpError("Ajoutez un lien Google Drive ou une vidéo depuis votre PC.");
  }
  const media = videoUpload
    ? { url: await checkUploadedVideo(videoUpload), provider: "upload", driveUrl: "" }
    : { driveUrl: cleanDriveUrl, url: normalizeDriveUrl(cleanDriveUrl, "video"), provider: driveProvider(provider) };

  const settings = await getOrCreateSettings();
  settings.testimonialVideos.push({
    ...media,
    thumbnail: thumbnail ? (isBase64Image(thumbnail) ? thumbnail : normalizeDriveUrl(thumbnail, "image")) : "",
    category:  category || "unknown",
  });
  await settings.save();
  // Met la nouvelle vidéo Drive en cache serveur en arrière-plan (lecture rapide).
  if (!videoUpload) warmDriveVideoCache();

  res.status(201).json(settings.testimonialVideos[settings.testimonialVideos.length - 1]);
});

/* ── PATCH /api/settings/testimonials/:id ─────────────────────────────────────
   Modifie un témoignage vidéo existant (lien Drive ↔ vidéo du PC, miniature,
   catégorie). L'ancienne vidéo envoyée depuis le PC est supprimée du disque
   quand elle est remplacée. Réservé admin. */
export const updateTestimonialVideo = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const testimonial = settings.testimonialVideos.id(req.params.id);
  if (!testimonial) {
    const err = new Error("Témoignage introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const { driveUrl, provider, thumbnail, category, videoUpload } = req.body;
  const previousUpload = uploadedUrlOf(testimonial);
  let driveChanged = false;
  if (videoUpload) {
    if (videoUpload !== testimonial.url) testimonial.url = await checkUploadedVideo(videoUpload);
    testimonial.provider = "upload";
    testimonial.driveUrl = "";
  } else if (driveUrl !== undefined) {
    const cleanDriveUrl = typeof driveUrl === "string" ? driveUrl.trim() : "";
    if (!cleanDriveUrl) throw httpError("Le lien Google Drive de la vidéo est requis.");
    testimonial.driveUrl = cleanDriveUrl;
    testimonial.url = normalizeDriveUrl(cleanDriveUrl, "video");
    testimonial.provider = driveProvider(provider);
    driveChanged = true;
  } else if (provider !== undefined && provider !== "upload" && testimonial.provider !== "upload") {
    testimonial.provider = provider;
  }
  if (thumbnail !== undefined) testimonial.thumbnail = isBase64Image(thumbnail) ? thumbnail : normalizeDriveUrl(thumbnail, "image");
  if (category !== undefined)  testimonial.category = category;

  await settings.save();
  if (previousUpload && previousUpload !== testimonial.url) releaseUploads(settings, [previousUpload]);
  if (driveChanged) warmDriveVideoCache();
  res.json(testimonial);
});

/* ── DELETE /api/settings/testimonials/:id ────────────────────────────────────
   Supprime un témoignage vidéo (et sa vidéo envoyée depuis le PC, le cas
   échéant). Réservé admin. */
export const deleteTestimonialVideo = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const testimonial = settings.testimonialVideos.id(req.params.id);
  if (!testimonial) {
    const err = new Error("Témoignage introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const previousUpload = uploadedUrlOf(testimonial);
  testimonial.deleteOne();
  await settings.save();
  if (previousUpload) releaseUploads(settings, [previousUpload]);
  res.json({ message: "Témoignage supprimé.", id: req.params.id });
});
