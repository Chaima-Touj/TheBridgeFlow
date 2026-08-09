/**
 * Génère une vraie miniature (frame extrait à t=2s via ffmpeg) pour chacun
 * des 28 témoignages Drive (SiteSettings.testimonialVideos), à uploader
 * ensuite dans le Shared Drive "Formation" (nouveau dossier "Thumbs-Feedbacks",
 * même convention de nommage que "Thumbs-videos" déjà existant) et à écrire
 * dans testimonialVideos[].thumbnail — comme si l'admin l'avait fait
 * manuellement.
 *
 * DEUX PHASES, dry-run par défaut :
 *
 *   SANS --confirm (par défaut) — extraction seulement, rien sur Drive/DB :
 *     1. Télécharge temporairement chacune des 28 vidéos (source :
 *        TheBridgeFlow Feedbacks, via les URLs déjà en base — pas un scan de
 *        dossier).
 *     2. Extrait 1 frame par vidéo à t=2s (évite les débuts noirs/fondus).
 *        Repli automatique si une vidéo dure moins de 3s (rare, filet de
 *        sécurité).
 *     3. Supprime la vidéo temporaire, garde le JPG.
 *     4. Assemble une planche de contact (grille 7 colonnes, légendée par
 *        catégorie + nom Drive) pour validation visuelle AVANT tout upload.
 *     5. Écrit manifest.json (fileId ↔ nom de fichier ↔ catégorie) — c'est ce
 *        manifeste, pas un nouveau scan, qui sert de source à la phase
 *        --confirm (exécutions dry-run et --confirm typiquement séparées
 *        dans le temps, le mapping doit survivre entre les deux).
 *
 *   AVEC --confirm — repart du manifest.json + des JPG déjà extraits
 *   (ne re-télécharge/ré-extrait rien) :
 *     1. Trouve ou crée le dossier "Thumbs-Feedbacks" à la racine du Shared
 *        Drive "Formation".
 *     2. Upload chaque JPG dedans (drive.files.create).
 *     3. Met à jour SiteSettings.testimonialVideos[].thumbnail pour l'entrée
 *        correspondante (association par fileId, retrouvée via le manifest —
 *        équivalent à un matching par nom de fichier puisque le manifest est
 *        lui-même indexé par nom de fichier).
 *
 * Prérequis --confirm : authenticate.js doit avoir été relancé pour drive1
 * APRÈS l'élargissement du scope dans oauthClient.js (drive.readonly +
 * drive.file) — sans ça, l'upload échoue avec une erreur de permission (403).
 * Le script le rappelle explicitement avant de démarrer en mode --confirm.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/drive/generate-testimonial-thumbnails.js
 *   node thebridgeflow-back/scripts/drive/generate-testimonial-thumbnails.js --confirm
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { execFile } from "child_process";
import { promisify } from "util";
import { google } from "googleapis";
import mongoose from "mongoose";
import { getAuthorizedClient } from "./oauthClient.js";
import SiteSettings from "../../models/siteSettings.model.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const CONFIRM = process.argv.includes("--confirm");

const OUTPUT_DIR      = path.join(os.homedir(), "Downloads", "thebridgeflow-testimonial-thumbnails");
const FRAMES_DIR       = path.join(OUTPUT_DIR, "frames");
const LABELED_DIR      = path.join(OUTPUT_DIR, "_contact-sheet-labeled");
const CONTACT_SHEET_PATH = path.join(OUTPUT_DIR, "contact-sheet.jpg");
const MANIFEST_PATH    = path.join(OUTPUT_DIR, "manifest.json");
const TEMP_VIDEO_DIR   = path.join(os.tmpdir(), "tbf-thumb-extract");

// Shared Drive "Formation" — mêmes IDs que ceux déjà utilisés/confirmés par
// inventory.js et l'exploration de ce même dossier.
const FORMATION_DRIVE_ID = "0AOffyQncQYm5Uk9PVA";
const THUMBS_FEEDBACKS_FOLDER_NAME = "Thumbs-Feedbacks";

const EXTRACT_TIMESTAMP_SEC = 2;
const CONTACT_SHEET_COLS = 7;

const DRIVE_FILE_REGEX = /\/file\/d\/([^/?#&]+)/;
function extractDriveFileId(url = "") {
  const m = url.match(DRIVE_FILE_REGEX);
  return m ? m[1] : null;
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_");
}

async function ffprobeDuration(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

async function downloadFile(authClient, fileId, destPath) {
  const { token } = await authClient.getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`téléchargement échoué (${res.status})`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(destPath));
}

async function extractFrame(videoPath, outPath, atSec) {
  await execFileAsync("ffmpeg", [
    "-y", "-ss", String(atSec), "-i", videoPath,
    "-frames:v", "1", "-q:v", "2", outPath,
  ]);
}

// Copie légendée (catégorie + nom Drive incrusté) — séparée du JPG "propre"
// qui sera réellement uploadé, pour ne jamais mélanger légende et miniature
// finale.
async function makeLabeledCopy(framePath, label, outPath) {
  const escaped = label.replace(/:/g, "\\:").replace(/'/g, "\\'");
  const fontFile = "C\\:/Windows/Fonts/arial.ttf";
  await execFileAsync("ffmpeg", [
    "-y", "-i", framePath,
    "-vf",
    `scale=200:356:force_original_aspect_ratio=decrease,pad=200:356:(ow-iw)/2:(oh-ih)/2:color=black,` +
    `drawtext=fontfile='${fontFile}':text='${escaped}':x=4:y=h-th-4:fontsize=12:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=3`,
    outPath,
  ]);
}

async function buildContactSheet(labeledPaths, outPath, cols) {
  const rows = Math.ceil(labeledPaths.length / cols);
  const seqDir = path.dirname(labeledPaths[0]);
  labeledPaths.forEach((p, i) => {
    fs.copyFileSync(p, path.join(seqDir, `seq_${String(i + 1).padStart(3, "0")}.jpg`));
  });
  await execFileAsync("ffmpeg", [
    "-y", "-framerate", "1", "-i", path.join(seqDir, "seq_%03d.jpg"),
    "-vf", `tile=${cols}x${rows}`,
    outPath,
  ]);
}

async function findOrCreateThumbsFeedbacksFolder(drive) {
  const q = [
    `name = '${THUMBS_FEEDBACKS_FOLDER_NAME}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `'${FORMATION_DRIVE_ID}' in parents`,
  ].join(" and ");
  const existing = await drive.files.list({
    q, fields: "files(id, name)", pageSize: 5,
    supportsAllDrives: true, includeItemsFromAllDrives: true,
  });
  if (existing.data.files.length > 0) return existing.data.files[0].id;

  const created = await drive.files.create({
    requestBody: {
      name: THUMBS_FEEDBACKS_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: [FORMATION_DRIVE_ID],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return created.data.id;
}

/* ── Phase dry-run (extraction) ─────────────────────────────────────────── */
async function runExtraction() {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(LABELED_DIR, { recursive: true });
  fs.mkdirSync(TEMP_VIDEO_DIR, { recursive: true });

  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);
  const settings = await SiteSettings.findOne();
  const testimonials = settings?.testimonialVideos ?? [];
  console.log(`${testimonials.length} témoignage(s) trouvé(s) en base.\n`);

  console.log("Connexion à Google Drive (drive1)...");
  const authDrive1 = await getAuthorizedClient("drive1");
  const drive = google.drive({ version: "v3", auth: authDrive1 });

  const manifest = [];
  for (const [idx, t] of testimonials.entries()) {
    const fileId = extractDriveFileId(t.url);
    if (!fileId) {
      console.log(`  ⚠ [${idx}] pas d'ID Drive extrait de "${t.url}" — ignoré.`);
      continue;
    }
    try {
      const meta = await drive.files.get({ fileId, fields: "name", supportsAllDrives: true });
      const baseName = sanitizeFilename(path.basename(meta.data.name, path.extname(meta.data.name)));
      const tempVideoPath = path.join(TEMP_VIDEO_DIR, `${baseName}${path.extname(meta.data.name) || ".mp4"}`);
      const framePath = path.join(FRAMES_DIR, `${baseName}.jpg`);
      const labeledPath = path.join(LABELED_DIR, `${baseName}__labeled.jpg`);

      console.log(`  [${idx + 1}/${testimonials.length}] ${meta.data.name} (${t.category})`);
      await downloadFile(authDrive1, fileId, tempVideoPath);

      const duration = await ffprobeDuration(tempVideoPath);
      const ts = duration && duration < 3 ? Math.max(0.2, duration / 2) : EXTRACT_TIMESTAMP_SEC;
      await extractFrame(tempVideoPath, framePath, ts);
      await makeLabeledCopy(framePath, `${t.category}: ${meta.data.name}`, labeledPath);

      fs.unlinkSync(tempVideoPath);
      manifest.push({ fileId, category: t.category, driveName: meta.data.name, baseName, ok: true });
    } catch (err) {
      console.log(`    ❌ échec : ${err.message}`);
      manifest.push({ fileId, category: t.category, ok: false, error: err.message });
    }
  }

  const ok = manifest.filter((r) => r.ok);
  console.log(`\n${ok.length}/${testimonials.length} miniatures extraites avec succès.`);

  if (ok.length > 0) {
    console.log("Construction de la planche de contact...");
    const labeledPaths = ok.map((r) => path.join(LABELED_DIR, `${r.baseName}__labeled.jpg`));
    await buildContactSheet(labeledPaths, CONTACT_SHEET_PATH, CONTACT_SHEET_COLS);
    console.log(`✅ Planche de contact : ${CONTACT_SHEET_PATH}`);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`✅ Manifest : ${MANIFEST_PATH}`);
  console.log(`✅ Frames individuelles : ${FRAMES_DIR}`);

  console.log("\nDry run terminé — aucun accès Drive en écriture, aucune modification MongoDB.");
  console.log("Vérifie la planche de contact avant de relancer avec --confirm.");

  await mongoose.disconnect();
}

/* ── Phase --confirm (upload + écriture DB) ────────────────────────────── */
async function runUploadAndWrite() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest introuvable (${MANIFEST_PATH}) — lance d'abord le script sans --confirm.`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")).filter((r) => r.ok);
  console.log(`${manifest.length} miniature(s) à uploader (depuis le manifest de la dernière extraction).\n`);

  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  const settings = await SiteSettings.findOne();

  console.log("Connexion à Google Drive (drive1)...");
  const authDrive1 = await getAuthorizedClient("drive1");
  const drive = google.drive({ version: "v3", auth: authDrive1 });

  console.log(`Résolution du dossier "${THUMBS_FEEDBACKS_FOLDER_NAME}"...`);
  const thumbsFolderId = await findOrCreateThumbsFeedbacksFolder(drive);

  let uploaded = 0, updated = 0, skipped = 0;
  for (const entry of manifest) {
    // Reprise idempotente : une entrée déjà pourvue d'un thumbnail en base
    // (upload + écriture précédents réussis, éventuellement lors d'un run
    // interrompu plus tôt) n'est jamais ré-uploadée — sans ce filtre, Drive
    // se retrouve avec des fichiers en double à chaque relance partielle.
    const target = settings.testimonialVideos.find(
      (t) => extractDriveFileId(t.url) === entry.fileId
    );
    if (target?.thumbnail) {
      console.log(`  ⏭  ${entry.driveName} — thumbnail déjà en base, ignoré.`);
      skipped++;
      continue;
    }

    const framePath = path.join(FRAMES_DIR, `${entry.baseName}.jpg`);
    if (!fs.existsSync(framePath)) {
      console.log(`  ⚠ frame introuvable pour ${entry.driveName} (${framePath}) — ignoré.`);
      continue;
    }

    const created = await drive.files.create({
      requestBody: { name: `${entry.baseName}.jpg`, parents: [thumbsFolderId] },
      media: { mimeType: "image/jpeg", body: fs.createReadStream(framePath) },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });
    // Sans ça, le fichier hérite d'un partage restreint (accessible au compte
    // OAuth, pas au public) — /api/drive-thumbnail (fetch non authentifié,
    // même mécanisme que pour les vidéos déjà partagées manuellement en
    // "Anyone with the link") reçoit alors une page HTML de permission au
    // lieu du JPEG, bloquée côté navigateur (ERR_BLOCKED_BY_ORB), vérifié en
    // testant en direct la chaîne de redirection Drive sur un fichier fraîchement
    // uploadé vs un fichier vidéo déjà partagé.
    await drive.permissions.create({
      fileId: created.data.id,
      requestBody: { role: "reader", type: "anyone" },
      supportsAllDrives: true,
    });
    uploaded++;
    const thumbnailUrl = created.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`;

    if (target) {
      target.thumbnail = thumbnailUrl;
      // Persistance immédiate, item par item — pas un save() groupé en fin
      // de boucle : sans ça, un crash sur un fichier plus loin (ECONNRESET,
      // déjà vécu) laisse le fichier bel et bien sur Drive mais SANS trace
      // en base, l'écriture entière de la session étant perdue avec lui.
      await settings.save();
      updated++;
      console.log(`  ✅ ${entry.driveName} → uploadé + thumbnail écrit`);
    } else {
      console.log(`  ⚠ ${entry.driveName} uploadé mais aucune entrée testimonialVideos correspondante (fileId ${entry.fileId}) — DB non modifiée pour celui-ci.`);
    }
  }

  console.log(`\n${uploaded} fichier(s) uploadé(s) dans "${THUMBS_FEEDBACKS_FOLDER_NAME}", ${updated} entrée(s) testimonialVideos mise(s) à jour, ${skipped} ignorée(s) (déjà faites).`);

  await mongoose.disconnect();
}

async function main() {
  console.log(`Mode : ${CONFIRM ? "UPLOAD + ÉCRITURE DB (--confirm)" : "DRY RUN (extraction + planche de contact — aucune écriture Drive/DB)"}\n`);

  if (CONFIRM) {
    console.log("⚠ Rappel : ce mode nécessite que drive1 ait été ré-authentifié APRÈS");
    console.log("  l'élargissement du scope dans oauthClient.js (drive.readonly + drive.file) :");
    console.log("    node thebridgeflow-back/scripts/drive/authenticate.js drive1");
    console.log("  Sans ça, l'upload échouera avec une erreur de permission (403).\n");
    await runUploadAndWrite();
  } else {
    await runExtraction();
  }
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
