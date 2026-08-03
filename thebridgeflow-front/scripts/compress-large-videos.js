// Compresses the local demo videos that are too big for the current
// Cloudinary plan (> 100MB) so they can be re-uploaded afterwards.
// Does NOT touch the originals, does NOT touch upload-to-cloudinary.js or
// cloudinary-urls.json — purely produces smaller copies under
// thebridgeflow-front/public-compressed/, mirroring the videos-*/ subfolder structure.
//
// Usage:  node thebridgeflow-front/scripts/compress-large-videos.js
// Requires ffmpeg on PATH (confirmed present: 8.1.2, libx264 enabled).

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const OUT_DIR = path.join(__dirname, "..", "public-compressed");
const SIZE_LIMIT = 100 * 1024 * 1024; // Cloudinary plan cap: 104,857,600 bytes
const CRF_DEFAULT = 28;
const CRF_FALLBACK = 32; // used only if CRF 28 still doesn't get under the limit

process.on("uncaughtException", (err) => {
  console.error(`\n💥 EXCEPTION NON INTERCEPTÉE: ${err?.stack || err}`);
  process.exit(1);
});

function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Same discovery approach as upload-to-cloudinary.js, but filtered to files
// that actually exceed the plan's size limit — no dependency on parsing the
// upload script's logs, so this works even from a clean slate.
function findOversizedVideos() {
  const files = [];
  for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("videos-")) {
      const dirPath = path.join(PUBLIC_DIR, entry.name);
      for (const fileEntry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (fileEntry.isFile() && fileEntry.name.toLowerCase().endsWith(".mp4")) {
          const absPath = path.join(dirPath, fileEntry.name);
          const size = fs.statSync(absPath).size;
          if (size > SIZE_LIMIT) {
            files.push({ absPath, subfolder: entry.name, fileName: fileEntry.name, originalSize: size });
          }
        }
      }
    }
  }
  return files.sort((a, b) => b.originalSize - a.originalSize);
}

function runFfmpeg(inputPath, outputPath, crf) {
  const args = [
    "-y", // outputPath is always a fresh compressed copy, never the original
    "-i", inputPath,
    "-c:v", "libx264",
    "-crf", String(crf),
    "-preset", "medium",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath,
  ];
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const tail = (result.stderr || "").split("\n").slice(-15).join("\n");
    throw new Error(`ffmpeg a échoué (code ${result.status}):\n${tail}`);
  }
}

function compressOne(video) {
  const outDir = path.join(OUT_DIR, video.subfolder);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, video.fileName);

  console.log(`\n[${video.subfolder}/${video.fileName}] original: ${formatSize(video.originalSize)}`);
  console.log(`  ↳ compression CRF ${CRF_DEFAULT} (preset medium, audio AAC 128k)...`);
  const start = Date.now();
  runFfmpeg(video.absPath, outPath, CRF_DEFAULT);
  let compressedSize = fs.statSync(outPath).size;
  let crfUsed = CRF_DEFAULT;
  console.log(`  ↳ résultat: ${formatSize(compressedSize)} en ${((Date.now() - start) / 1000).toFixed(1)}s`);

  if (compressedSize > SIZE_LIMIT) {
    console.log(`  ↳ toujours au-dessus de 100MB, recompression avec CRF ${CRF_FALLBACK}...`);
    const start2 = Date.now();
    runFfmpeg(video.absPath, outPath, CRF_FALLBACK);
    compressedSize = fs.statSync(outPath).size;
    crfUsed = CRF_FALLBACK;
    console.log(`  ↳ résultat: ${formatSize(compressedSize)} en ${((Date.now() - start2) / 1000).toFixed(1)}s`);
  }

  return {
    file: `${video.subfolder}/${video.fileName}`,
    originalSize: video.originalSize,
    compressedSize,
    crfUsed,
    underLimit: compressedSize <= SIZE_LIMIT,
  };
}

function run() {
  const videos = findOversizedVideos();
  console.log(`${videos.length} fichier(s) au-dessus de ${formatSize(SIZE_LIMIT)} trouvé(s).`);
  if (!videos.length) {
    console.log("Rien à compresser.");
    return;
  }

  const results = [];
  for (const video of videos) {
    try {
      results.push(compressOne(video));
    } catch (err) {
      console.error(`  ↳ ÉCHEC pour ${video.subfolder}/${video.fileName}: ${err.message}`);
      results.push({
        file: `${video.subfolder}/${video.fileName}`,
        originalSize: video.originalSize,
        compressedSize: null,
        crfUsed: null,
        underLimit: false,
        error: err.message,
      });
    }
  }

  console.log(`\n${"=".repeat(90)}`);
  console.log("RÉCAPITULATIF");
  console.log("=".repeat(90));
  const rows = results.map((r) => ({
    Fichier: r.file,
    "Taille originale": formatSize(r.originalSize),
    "Taille compressée": r.compressedSize != null ? formatSize(r.compressedSize) : "ÉCHEC",
    CRF: r.crfUsed ?? "-",
    "< 100MB": r.error ? "N/A" : r.underLimit ? "oui" : "NON — toujours trop gros",
  }));
  console.table(rows);

  const stillOver = results.filter((r) => !r.underLimit && !r.error);
  const failed = results.filter((r) => r.error);
  if (stillOver.length) {
    console.log(`\n⚠️  ${stillOver.length} fichier(s) restent au-dessus de 100MB même en CRF ${CRF_FALLBACK}:`);
    stillOver.forEach((r) => console.log(`  - ${r.file} (${formatSize(r.compressedSize)})`));
  }
  if (failed.length) {
    console.log(`\n💥 ${failed.length} échec(s) ffmpeg:`);
    failed.forEach((r) => console.log(`  - ${r.file}: ${r.error}`));
  }
  console.log(`\nFichiers compressés écrits dans ${OUT_DIR} (originaux intacts dans public/).`);
}

run();
