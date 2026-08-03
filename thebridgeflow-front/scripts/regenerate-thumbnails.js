// Regenerates the static week/supervision thumbnail JPGs (thebridgeflow-front/public/images/*-thumbs/)
// from the newly-compressed videos, after a Cloudinary video replacement —
// these thumbnails are plain static files extracted once via ffmpeg, NOT a
// Cloudinary-derived transformation, so they go stale silently when the
// source video changes and nothing else re-extracts them.
//
// Usage: node thebridgeflow-front/scripts/regenerate-thumbnails.js <mapping.json> <compressed-dir>
// mapping.json: [{ videoBasename, thumbnail }] — thumbnail is the "/images/..." path.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const mappingPath = process.argv[2];
const compressedDir = process.argv[3];
if (!mappingPath || !compressedDir) {
  console.error("Usage: node regenerate-thumbnails.js <mapping.json> <compressed-dir>");
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
const results = [];

for (const rawEntry of mapping) {
  const { videoBasename, formation } = rawEntry;
  // Certaines valeurs thumbnail en base ont un espace parasite en fin de
  // chaîne (ex: "sem1-thumb.jpg ") qui fait échouer la détection du format
  // de sortie par ffmpeg ("Unable to choose an output format") — trim défensif.
  const thumbnail = rawEntry.thumbnail.trim();
  const videoPath = path.join(compressedDir, `${videoBasename}.mp4`);
  const thumbPath = path.join(PUBLIC_DIR, thumbnail.replace(/^\//, ""));

  if (!fs.existsSync(videoPath)) {
    console.log(`✗ ${videoBasename}: vidéo compressée introuvable (${videoPath})`);
    results.push({ videoBasename, thumbnail, status: "ÉCHEC", error: "vidéo introuvable" });
    continue;
  }

  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
  const beforeSize = fs.existsSync(thumbPath) ? fs.statSync(thumbPath).size : null;
  const beforeMtime = fs.existsSync(thumbPath) ? fs.statSync(thumbPath).mtime.toISOString() : null;

  // -ss before -i: fast seek. 2s in, to skip a possible black/fade-in first frame.
  const args = ["-y", "-ss", "2", "-i", videoPath, "-vframes", "1", "-q:v", "3", thumbPath];
  const res = spawnSync("ffmpeg", args, { encoding: "utf8" });

  if (res.status !== 0 || !fs.existsSync(thumbPath)) {
    const tail = (res.stderr || "").split("\n").slice(-8).join("\n");
    console.log(`✗ ${videoBasename}: échec ffmpeg — ${tail}`);
    results.push({ videoBasename, thumbnail, status: "ÉCHEC", error: tail });
    continue;
  }

  const afterSize = fs.statSync(thumbPath).size;
  console.log(`✓ ${formation}/${videoBasename} -> ${thumbnail} (${beforeSize ?? "—"}B -> ${afterSize}B)`);
  results.push({ videoBasename, thumbnail, formation, status: "OK", beforeSize, beforeMtime, afterSize });
}

fs.writeFileSync(path.join(compressedDir, "thumbnails-regen.json"), JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.status === "OK").length;
console.log(`\n${ok}/${results.length} miniatures régénérées avec succès.`);
