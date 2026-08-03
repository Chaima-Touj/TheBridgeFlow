// Compresses the freshly re-recorded videos in a local source folder and
// OVERWRITES the matching existing Cloudinary asset (same public_id) for
// each one, so the site picks up the new content without any code change —
// relies on the version-less URLs already in videoUrls.js (see
// generate-video-urls.js) to always resolve to the current asset.
//
// Does NOT touch any video whose filename doesn't already have a matching
// entry in cloudinary-urls.json — unmatched files are only reported, never
// uploaded.
//
// Usage:
//   node thebridgeflow-front/scripts/overwrite-cloudinary-videos.js "C:\path\to\source\folder"
//
// Resumable: progress is written to <sourceDir>/compressed/progress.json
// after every file. Re-running skips files already marked "done".
//
// Reads CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// from thebridgeflow-front/.env (same as upload-to-cloudinary.js).

import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
// @ts-expect-error process is a global in Node.js
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error("Missing Cloudinary credentials in thebridgeflow-front/.env.");
  process.exit(1);
}
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

process.on("uncaughtException", (err) => {
  console.error(`\n💥 EXCEPTION NON INTERCEPTÉE — le script s'arrête: ${err?.stack || err}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(`\n💥 PROMESSE REJETÉE NON GÉRÉE — le script s'arrête: ${reason?.stack || reason}`);
  process.exit(1);
});

const SOURCE_DIR = process.argv[2];
if (!SOURCE_DIR || !fs.existsSync(SOURCE_DIR)) {
  console.error("Usage: node overwrite-cloudinary-videos.js <source-dir>");
  process.exit(1);
}
const OUT_DIR = path.join(SOURCE_DIR, "compressed");
const PROGRESS_PATH = path.join(OUT_DIR, "progress.json");
const MAPPING_PATH = path.join(__dirname, "cloudinary-urls.json");
const SIZE_LIMIT = 100 * 1024 * 1024; // Cloudinary plan cap
const CRF_DEFAULT = 28;
const CRF_FALLBACK = 32;
const CHUNK_SIZE = 20 * 1024 * 1024;

fs.mkdirSync(OUT_DIR, { recursive: true });

function formatSize(bytes) {
  if (bytes == null) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── 1. Match source filenames against cloudinary-urls.json ────────────────
function buildTargets() {
  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, "utf8"));
  const byBasename = {};
  for (const key of Object.keys(mapping)) {
    const parts = key.split("/").filter(Boolean);
    const fileName = parts[parts.length - 1];
    const subfolder = parts.length > 1 ? parts[0] : null;
    const folder = subfolder ? `stageflow/${subfolder}` : "stageflow";
    const publicId = fileName.replace(/\.mp4$/i, "");
    byBasename[fileName.toLowerCase()] = { fileName, subfolder, fullPublicId: `${folder}/${publicId}` };
  }

  const sourceFiles = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".mp4"))
    .map((e) => e.name);

  const matched = [];
  const unmatched = [];
  for (const fileName of sourceFiles) {
    const target = byBasename[fileName.toLowerCase()];
    if (target) {
      matched.push({
        fileName,
        absPath: path.join(SOURCE_DIR, fileName),
        outPath: path.join(OUT_DIR, fileName),
        fullPublicId: target.fullPublicId,
      });
    } else {
      unmatched.push(fileName);
    }
  }
  return { matched, unmatched };
}

// ─── 2. Compression (same command the user specified, with fallback) ───────
function runFfmpeg(inputPath, outputPath, { crf, scale }) {
  const args = ["-y", "-i", inputPath, "-vcodec", "libx264", "-crf", String(crf), "-preset", "medium"];
  if (scale) args.push("-vf", `scale=${scale}`);
  args.push("-acodec", "aac", "-b:a", "128k", outputPath);
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const tail = (result.stderr || "").split("\n").slice(-15).join("\n");
    throw new Error(`ffmpeg a échoué (code ${result.status}):\n${tail}`);
  }
}

function compress(item) {
  const originalSize = fs.statSync(item.absPath).size;
  console.log(`  ↳ compression CRF ${CRF_DEFAULT} (preset medium)...`);
  let start = Date.now();
  runFfmpeg(item.absPath, item.outPath, { crf: CRF_DEFAULT });
  let size = fs.statSync(item.outPath).size;
  let crfUsed = CRF_DEFAULT, scaleUsed = null;
  console.log(`    -> ${formatSize(size)} en ${((Date.now() - start) / 1000).toFixed(0)}s`);

  if (size > SIZE_LIMIT) {
    console.log(`  ↳ toujours > 100MB, repasse avec scale=1280:-2 (CRF ${CRF_DEFAULT})...`);
    start = Date.now();
    runFfmpeg(item.absPath, item.outPath, { crf: CRF_DEFAULT, scale: "1280:-2" });
    size = fs.statSync(item.outPath).size;
    scaleUsed = "1280:-2";
    console.log(`    -> ${formatSize(size)} en ${((Date.now() - start) / 1000).toFixed(0)}s`);
  }

  if (size > SIZE_LIMIT) {
    console.log(`  ↳ toujours > 100MB, repasse avec CRF ${CRF_FALLBACK} + scale=1280:-2...`);
    start = Date.now();
    runFfmpeg(item.absPath, item.outPath, { crf: CRF_FALLBACK, scale: "1280:-2" });
    size = fs.statSync(item.outPath).size;
    crfUsed = CRF_FALLBACK;
    scaleUsed = "1280:-2";
    console.log(`    -> ${formatSize(size)} en ${((Date.now() - start) / 1000).toFixed(0)}s`);
  }

  return { originalSize, compressedSize: size, crfUsed, scaleUsed, underLimit: size <= SIZE_LIMIT };
}

// ─── 3. Upload with overwrite:true + invalidate:true, exact public_id ──────
function uploadLargePromise(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(filePath, options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Network blips (DNS down, timeouts) are common over a multi-hour run — retry
// transient failures instead of giving up on the whole file. Non-retryable
// errors (bad auth, malformed request, file too large) fail fast.
function isRetryable(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  if (msg.includes("file size too large")) return false;
  if (msg.includes("invalid image file") || msg.includes("invalid video file")) return false;
  if (err?.http_code === 401 || err?.error?.http_code === 401) return false;
  if (err?.http_code === 400 || err?.error?.http_code === 400) return false;
  return true;
}

async function withRetry(fn, { attempts = 4, delayMs = 5000, label = "opération" } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) throw err;
      const msg = err?.message || String(err);
      console.log(`    ⚠️  ${label} — tentative ${attempt}/${attempts} échouée: ${msg}`);
      if (attempt < attempts) {
        console.log(`    … nouvelle tentative dans ${delayMs / 1000}s`);
        await sleep(delayMs);
      }
    }
  }
  throw lastErr;
}

async function getResourceInfo(publicId) {
  try {
    return await withRetry(
      () => cloudinary.api.resource(publicId, { resource_type: "video" }),
      { label: `lecture ${publicId}` }
    );
  } catch (err) {
    if (err?.http_code === 404 || err?.error?.http_code === 404) return null;
    throw err;
  }
}

async function processOne(item, progress) {
  console.log(`\n[${item.fileName}] -> ${item.fullPublicId}`);

  // Before: capture existing asset state for the verification step.
  const before = await getResourceInfo(item.fullPublicId);
  if (!before) {
    console.log(`  ⚠️  Aucun asset existant sous ce public_id — upload quand même (création).`);
  } else {
    console.log(`  ↳ avant: ${formatSize(before.bytes)}, version ${before.version}`);
  }

  const comp = compress(item);
  if (!comp.underLimit) {
    console.log(`  ⚠️  Reste au-dessus de 100MB (${formatSize(comp.compressedSize)}) même après repasse — upload tenté quand même (échouera probablement, plan Cloudinary).`);
  }

  let uploadResult, uploadError = null;
  try {
    uploadResult = await withRetry(
      () => uploadLargePromise(item.outPath, {
        resource_type: "video",
        public_id: item.fullPublicId,
        chunk_size: CHUNK_SIZE,
        overwrite: true,
        invalidate: true,
      }),
      { label: `upload ${item.fileName}`, attempts: 4, delayMs: 8000 }
    );
    console.log(`  ↳ upload OK -> version ${uploadResult.version}, ${formatSize(uploadResult.bytes)}`);
  } catch (err) {
    uploadError = err?.message || String(err);
    console.error(`  ↳ ÉCHEC upload (définitif): ${uploadError}`);
  }

  // Verify: re-fetch from the API (not just trust the upload response).
  // Cloudinary can briefly return stale metadata right after upload_large
  // (read-after-write lag) — retry a couple of times before concluding the
  // asset genuinely didn't change.
  let verify = { publicIdMatches: false, sizeChanged: false, versionIsNew: false, after: null };
  if (!uploadError) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const after = await getResourceInfo(item.fullPublicId);
      verify.after = after;
      if (after) {
        verify.publicIdMatches = after.public_id === item.fullPublicId;
        verify.sizeChanged = !before || after.bytes !== before.bytes;
        verify.versionIsNew = !before || String(after.version) !== String(before.version);
      }
      if (verify.publicIdMatches && verify.sizeChanged && verify.versionIsNew) break;
      if (attempt < 3) {
        console.log(`    ⚠️  Vérification pas encore concluante (tentative ${attempt}/3), nouvelle lecture dans 3s...`);
        await sleep(3000);
      }
    }
  }

  const record = {
    fileName: item.fileName,
    fullPublicId: item.fullPublicId,
    originalSize: comp.originalSize,
    compressedSize: comp.compressedSize,
    crfUsed: comp.crfUsed,
    scaleUsed: comp.scaleUsed,
    beforeBytes: before?.bytes ?? null,
    beforeVersion: before?.version ?? null,
    afterBytes: verify.after?.bytes ?? null,
    afterVersion: verify.after?.version ?? null,
    versionDate: verify.after?.version ? new Date(verify.after.version * 1000).toISOString() : null,
    uploadStatus: uploadError ? "ÉCHEC" : "succès",
    uploadError,
    verified: !uploadError && verify.publicIdMatches && verify.sizeChanged && verify.versionIsNew,
    doneAt: new Date().toISOString(),
  };
  progress.done[item.fileName] = record;
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
  return record;
}

async function run() {
  const { matched, unmatched } = buildTargets();

  console.log(`${matched.length} fichier(s) reconnu(s), ${unmatched.length} non reconnu(s).`);
  if (unmatched.length) {
    console.log(`\nFichiers SANS correspondance (non uploadés, à me préciser) :`);
    unmatched.forEach((f) => console.log(`  - ${f}`));
  }

  let progress = { done: {} };
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    console.log(`\nReprise: ${Object.keys(progress.done).length} fichier(s) déjà traité(s) dans une exécution précédente.`);
  }

  const runStart = Date.now();
  for (let i = 0; i < matched.length; i++) {
    const item = matched[i];
    if (progress.done[item.fileName]?.uploadStatus === "succès" && progress.done[item.fileName]?.verified) {
      console.log(`\n[${i + 1}/${matched.length}] ${item.fileName} — déjà traité avec succès, skip.`);
      continue;
    }
    console.log(`\n[${i + 1}/${matched.length}] ${((Date.now() - runStart) / 60000).toFixed(1)} min écoulées`);
    try {
      await processOne(item, progress);
    } catch (err) {
      console.error(`  ↳ ERREUR NON GÉRÉE pour ${item.fileName}: ${err.message}`);
      progress.done[item.fileName] = {
        fileName: item.fileName, fullPublicId: item.fullPublicId,
        uploadStatus: "ÉCHEC", uploadError: err.message, verified: false, doneAt: new Date().toISOString(),
      };
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
    }
  }

  console.log(`\n${"=".repeat(100)}`);
  console.log(`Terminé en ${((Date.now() - runStart) / 60000).toFixed(1)} min.`);
  const rows = matched.map((item) => progress.done[item.fileName]).filter(Boolean);
  console.table(rows.map((r) => ({
    Fichier: r.fileName,
    "Avant": formatSize(r.originalSize),
    "Après compression": formatSize(r.compressedSize),
    CRF: r.crfUsed ?? "-",
    Scale: r.scaleUsed ?? "-",
    "Public ID": r.fullPublicId,
    Upload: r.uploadStatus,
    Vérifié: r.verified ? "oui" : "NON",
  })));

  const failed = rows.filter((r) => r.uploadStatus !== "succès" || !r.verified);
  if (failed.length) {
    console.log(`\n⚠️  ${failed.length} fichier(s) en échec ou non vérifié(s) :`);
    failed.forEach((r) => console.log(`  - ${r.fileName}: ${r.uploadError || "vérification échouée"}`));
  } else {
    console.log(`\n✅ Tous les fichiers reconnus ont été compressés, uploadés et vérifiés avec succès.`);
  }
  console.log(`\nProgression détaillée: ${PROGRESS_PATH}`);
}

run();
