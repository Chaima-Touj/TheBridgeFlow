import SiteSettings from "../models/siteSettings.model.js";
import asyncHandler  from "../utils/asyncHandler.js";
import { normalizeDriveUrl } from "../utils/driveHelper.js";

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
  res.json(settings);
});

/* ── PATCH /api/settings ──────────────────────────────────────────────────────
   Réservé admin. Normalise automatiquement actionVideo.driveUrl vers
   actionVideo.url (lien /preview) via normalizeDriveUrl, comme
   patchFormationTrailer pour Formation.                                     */
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  const { actionVideo } = req.body;

  if (actionVideo !== undefined) {
    const { driveUrl, provider, thumbnail } = actionVideo;

    if (driveUrl !== undefined) {
      settings.actionVideo.driveUrl = driveUrl;
      settings.actionVideo.url = normalizeDriveUrl(driveUrl, "video");
    }
    if (provider !== undefined)  settings.actionVideo.provider = provider;
    if (thumbnail !== undefined) settings.actionVideo.thumbnail = normalizeDriveUrl(thumbnail, "image");
  }

  await settings.save();
  res.json(settings);
});
