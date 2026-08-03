// Migrates the local demo videos (thebridgeflow-front/public/videos-*/, stageflow-promo.mp4)
// to Cloudinary so they're actually reachable in production (they're too big
// to commit to Git, so Render never had them).
//
// Usage:  node thebridgeflow-front/scripts/upload-to-cloudinary.js
// Reads CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// from thebridgeflow-front/.env (see thebridgeflow-front/.env.example). Safe to re-run: any file
// already present on Cloudinary under its target public_id is skipped, so an
// interrupted run can just be restarted.

import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
// @ts-expect-error process is a global in Node.js
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error(
    "Missing Cloudinary credentials. Fill CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY " +
    "and CLOUDINARY_API_SECRET in thebridgeflow-front/.env (see thebridgeflow-front/.env.example)."
  );
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// Without these, a bug that throws outside the per-file try/catch (or an
// unawaited rejected promise anywhere in the cloudinary SDK's internals)
// kills the process silently — no stack trace, nothing written past the
// last successful file, and from the outside it just looks like the script
// "stopped for no reason". Always log loudly before exiting.
process.on("uncaughtException", (err) => {
  console.error(`\n💥 EXCEPTION NON INTERCEPTÉE — le script s'arrête: ${err?.stack || err}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(`\n💥 PROMESSE REJETÉE NON GÉRÉE — le script s'arrête: ${reason?.stack || reason}`);
  process.exit(1);
});

// Optional: node scripts/upload-to-cloudinary.js public-compressed
// Lets the same tested upload logic (retry rules, resumability, mapping
// merge) run against the ffmpeg-compressed copies without touching their
// resulting public_id/folder — cloudinaryTarget() only ever looks at
// subfolder + fileName, never the source directory, so uploading from
// public-compressed/videos-IoT/x.mp4 still lands at stageflow/videos-IoT/x,
// exactly where the (too-large) original would have gone.
const sourceDirArg = process.argv[2] || "public";
const PUBLIC_DIR = path.join(__dirname, "..", sourceDirArg);
const MAPPING_PATH = path.join(__dirname, "cloudinary-urls.json");
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB — safe chunk size for the >200MB files
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

// ─── Discover every .mp4 under public/videos-*/ and directly in public/ ──────
function findVideos() {
  const files = [];

  // public/*.mp4 (root level, e.g. stageflow-promo.mp4)
  for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp4")) {
      files.push({ absPath: path.join(PUBLIC_DIR, entry.name), subfolder: null, fileName: entry.name });
    }
  }

  // public/videos-*/*.mp4
  for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("videos-")) {
      const dirPath = path.join(PUBLIC_DIR, entry.name);
      for (const fileEntry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (fileEntry.isFile() && fileEntry.name.toLowerCase().endsWith(".mp4")) {
          files.push({ absPath: path.join(dirPath, fileEntry.name), subfolder: entry.name, fileName: fileEntry.name });
        }
      }
    }
  }

  return files;
}

function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// public_id (without extension) + folder, matching stageflow/<subfolder>/<filename>
function cloudinaryTarget({ subfolder, fileName }) {
  const baseName = fileName.replace(/\.mp4$/i, "");
  const folder = subfolder ? `stageflow/${subfolder}` : "stageflow";
  return { folder, public_id: baseName, fullPublicId: `${folder}/${baseName}` };
}

// The local path exactly as it's referenced elsewhere (leading slash, relative
// to public/) — this is the key format the DB migration / code replacement
// step needs, since that's how these paths are actually stored/used.
function localPathKey({ subfolder, fileName }) {
  return subfolder ? `/${subfolder}/${fileName}` : `/${fileName}`;
}

async function alreadyUploaded(fullPublicId) {
  try {
    await cloudinary.api.resource(fullPublicId, { resource_type: "video" });
    return true;
  } catch (err) {
    if (err?.http_code === 404 || err?.error?.http_code === 404) return false;
    // Any other error (auth, network) — don't silently assume "not uploaded",
    // surface it so the caller can decide whether to retry the upload anyway.
    throw err;
  }
}

// cloudinary.uploader.upload_large() does NOT return a promise when called
// without a callback (it silently resolves to something un-thenable instead
// of the upload result) — has to be wrapped manually, or result.secure_url
// comes back undefined despite the upload having actually succeeded.
function uploadLargePromise(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(filePath, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Errors where retrying is pointless: the request will fail identically
// every time (plan limit, malformed file, bad auth), so burning through
// MAX_ATTEMPTS just wastes minutes per file and spams the log. Only network
// blips / transient 5xx are worth retrying.
function isRetryable(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  if (msg.includes("file size too large")) return false;
  if (msg.includes("invalid image file") || msg.includes("invalid video file")) return false;
  if (err?.http_code === 401 || err?.error?.http_code === 401) return false; // bad credentials
  if (err?.http_code === 400 || err?.error?.http_code === 400) return false; // malformed request
  return true;
}

async function uploadWithRetry(video, target) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const attemptStart = Date.now();
    try {
      const result = await uploadLargePromise(video.absPath, {
        resource_type: "video",
        folder: target.folder,
        public_id: target.public_id,
        chunk_size: CHUNK_SIZE,
        overwrite: false,
        use_filename: true,
        unique_filename: false,
      });
      console.log(`    ✓ upload terminé en ${((Date.now() - attemptStart) / 1000).toFixed(1)}s`);
      return result;
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      const elapsed = ((Date.now() - attemptStart) / 1000).toFixed(1);
      if (!isRetryable(err)) {
        console.log(`    ✗ erreur non réessayable (après ${elapsed}s), abandon immédiat: ${msg}`);
        throw err;
      }
      console.log(`    ⚠️  Tentative ${attempt}/${MAX_ATTEMPTS} échouée (après ${elapsed}s) pour ${video.fileName}: ${msg}`);
      if (attempt < MAX_ATTEMPTS) {
        console.log(`    … nouvelle tentative dans ${RETRY_DELAY_MS / 1000}s`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastErr;
}

async function run() {
  const videos = findVideos();
  const totalBytes = videos.reduce((sum, v) => sum + fs.statSync(v.absPath).size, 0);
  console.log(`Trouvé ${videos.length} fichiers .mp4 (${formatSize(totalBytes)} au total).\n`);

  // Resume support: start from whatever mapping already exists on disk.
  let mapping = {};
  if (fs.existsSync(MAPPING_PATH)) {
    mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
    console.log(`Mapping existant chargé (${Object.keys(mapping).length} entrées) — reprise possible.\n`);
  }

  const failures = [];
  const oversized = [];
  let doneBytes = 0;
  const runStart = Date.now();

  for (let i = 0; i < videos.length; i++) {
    const video = videos[i];
    const size = fs.statSync(video.absPath).size;
    const target = cloudinaryTarget(video);
    const key = localPathKey(video);
    const progressPct = totalBytes ? ((doneBytes / totalBytes) * 100).toFixed(1) : "0.0";
    const elapsedTotal = ((Date.now() - runStart) / 1000).toFixed(0);
    const label = `[${i + 1}/${videos.length}] ${key} (${formatSize(size)})`;

    if (mapping[key]) {
      console.log(`${label} — déjà dans le mapping local, skip.`);
      doneBytes += size;
      continue;
    }

    const fileStart = Date.now();
    try {
      console.log(`${label} — vérification Cloudinary... (${progressPct}% du volume total, ${elapsedTotal}s écoulées)`);
      const exists = await alreadyUploaded(target.fullPublicId);
      if (exists) {
        const info = await cloudinary.api.resource(target.fullPublicId, { resource_type: "video" });
        mapping[key] = info.secure_url;
        console.log(`  ↳ déjà présent sur Cloudinary, réutilisé.`);
      } else {
        console.log(`  ↳ upload en cours (${target.folder}/${target.public_id})...`);
        const result = await uploadWithRetry(video, target);
        mapping[key] = result.secure_url;
        console.log(`  ↳ OK en ${((Date.now() - fileStart) / 1000).toFixed(1)}s -> ${result.secure_url}`);
      }
      // Persist after every file, not just at the end, so an interruption
      // never loses progress already made.
      fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2));
    } catch (err) {
      const msg = err?.message || String(err);
      console.error(`  ↳ ÉCHEC définitif pour ${key} (après ${((Date.now() - fileStart) / 1000).toFixed(1)}s): ${msg}`);
      if (msg.toLowerCase().includes("file size too large")) {
        oversized.push({ key, size });
      } else {
        failures.push(key);
      }
    }

    doneBytes += size;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Terminé en ${((Date.now() - runStart) / 1000 / 60).toFixed(1)} min. ${Object.keys(mapping).length}/${videos.length} vidéos dans le mapping.`);
  if (oversized.length) {
    console.log(`\n${oversized.length} fichier(s) dépassent la limite de taille du plan Cloudinary actuel :`);
    oversized.forEach((f) => console.log(`  - ${f.key} (${formatSize(f.size)})`));
    console.log(`Ces fichiers n'ont PAS été uploadés — aucune tentative supplémentaire ne les fera passer.`);
    console.log(`Options : compresser/transcoder ces fichiers avant upload, ou upgrader le plan Cloudinary.`);
  }
  if (failures.length) {
    console.log(`\n${failures.length} échec(s) après ${MAX_ATTEMPTS} tentatives chacun (probablement transitoires) :`);
    failures.forEach((f) => console.log(`  - ${f}`));
    console.log(`Relancez le script pour réessayer uniquement ces fichiers (les autres seront skip).`);
  }
  console.log(`\nMapping écrit dans ${MAPPING_PATH}`);
}

run().catch((err) => {
  console.error("Erreur fatale du script:", err);
  process.exit(1);
});
