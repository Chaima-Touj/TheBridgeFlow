import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import SiteSettings from "../models/siteSettings.model.js";
import { extractDriveFileId } from "../utils/driveHelper.js";

/* Cache serveur des vidéos témoignages hébergées sur Google Drive.

   Le lecteur intégré de Drive met plusieurs secondes à démarrer. L'admin garde
   ses liens Drive, mais chaque vidéo est téléchargée UNE fois sur ce serveur
   (dans uploads/, comme les CV) puis servie directement au lecteur <video> du
   site, avec la lecture par morceaux (Range) pour démarrer et avancer vite.

   Seules les vidéos référencées dans les témoignages (SiteSettings) peuvent
   être mises en cache : la route n'est pas un proxy Drive ouvert. */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DRIVE_VIDEO_CACHE_DIR = path.join(__dirname, "..", "uploads", "drive-video-cache");

const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,200}$/;
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const ALLOWLIST_TTL_MS = 60 * 1000;

const pendingDownloads = new Map();
let allowlist = { ids: new Set(), loadedAt: 0 };

export function isValidDriveFileId(fileId) {
  return typeof fileId === "string" && DRIVE_FILE_ID_REGEX.test(fileId);
}

export function invalidateDriveVideoAllowlist() {
  allowlist = { ids: new Set(), loadedAt: 0 };
}

async function getAllowedVideoIds() {
  if (Date.now() - allowlist.loadedAt < ALLOWLIST_TTL_MS) return allowlist.ids;
  const settings = await SiteSettings.findOne().select("testimonialVideos").lean();
  const ids = new Set();
  for (const video of settings?.testimonialVideos || []) {
    for (const url of [video.url, video.driveUrl]) {
      const id = extractDriveFileId(url || "");
      if (id && isValidDriveFileId(id)) ids.add(id);
    }
  }
  allowlist = { ids, loadedAt: Date.now() };
  return ids;
}

export async function isAllowedDriveVideo(fileId) {
  if (!isValidDriveFileId(fileId)) return false;
  return (await getAllowedVideoIds()).has(fileId);
}

export function cachedDriveVideoPath(fileId) {
  return path.join(DRIVE_VIDEO_CACHE_DIR, `${fileId}.mp4`);
}

async function downloadFromDrive(fileId) {
  await fsp.mkdir(DRIVE_VIDEO_CACHE_DIR, { recursive: true });
  const target = cachedDriveVideoPath(fileId);
  const temp = `${target}.${process.pid}.${Date.now()}.part`;

  const response = await fetch(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) },
  );
  if (!response.ok || !response.body) {
    throw new Error(`Google Drive download returned HTTP ${response.status}.`);
  }
  // Fichier non public, ou page d'avertissement de Drive à la place de la vidéo.
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("video/")) {
    throw new Error(`Google Drive did not return a video (content-type: ${contentType || "none"}).`);
  }
  if (Number(response.headers.get("content-length") || 0) > MAX_VIDEO_BYTES) {
    throw new Error("Video is larger than the cache limit.");
  }

  let received = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_VIDEO_BYTES) callback(new Error("Video is larger than the cache limit."));
      else callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body), sizeGuard, fs.createWriteStream(temp));
    // Renommage atomique : un fichier présent dans le cache est toujours complet.
    await fsp.rename(temp, target);
  } catch (error) {
    await fsp.rm(temp, { force: true });
    throw error;
  }
}

// Renvoie le chemin du fichier en cache, en le téléchargeant si besoin.
// Les demandes simultanées pour la même vidéo partagent un seul téléchargement.
export function ensureDriveVideoCached(fileId) {
  if (pendingDownloads.has(fileId)) return pendingDownloads.get(fileId);

  const job = (async () => {
    const target = cachedDriveVideoPath(fileId);
    try {
      await fsp.access(target);
      return target;
    } catch {
      await downloadFromDrive(fileId);
      return target;
    }
  })().finally(() => pendingDownloads.delete(fileId));

  pendingDownloads.set(fileId, job);
  return job;
}

// Pré-télécharge en arrière-plan toutes les vidéos témoignages pas encore en
// cache, une par une, pour que même le premier visiteur n'attende pas.
// Ne lève jamais d'erreur (un rejet non géré arrête le serveur, voir server.js).
let warmRunning = false;
let warmAgain = false;
export async function warmDriveVideoCache() {
  // Déjà en cours : on refera un tour à la fin (ex. vidéo ajoutée entre-temps).
  if (warmRunning) {
    warmAgain = true;
    return;
  }
  warmRunning = true;
  try {
    do {
      warmAgain = false;
      invalidateDriveVideoAllowlist();
      const ids = await getAllowedVideoIds();
      let downloaded = 0;
      for (const fileId of ids) {
        try {
          const alreadyCached = await fsp.access(cachedDriveVideoPath(fileId)).then(() => true, () => false);
          if (alreadyCached) continue;
          await ensureDriveVideoCached(fileId);
          downloaded += 1;
        } catch (error) {
          console.warn("[drive-video-cache] Could not cache video", { fileId, message: error.message });
        }
      }
      if (downloaded) console.log(`[drive-video-cache] ${downloaded} testimonial video(s) cached.`);
    } while (warmAgain);
  } catch (error) {
    console.warn("[drive-video-cache] Warm-up failed", { message: error.message });
  } finally {
    warmRunning = false;
  }
}
