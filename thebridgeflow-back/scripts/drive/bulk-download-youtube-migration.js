/**
 * Téléchargement local de sauvegarde des vidéos "landing page" hébergées sur
 * Google Drive : 5 trailers (Formation.trailerVideoUrl) + 28 témoignages
 * (SiteSettings.testimonialVideos), provider=google_drive uniquement — les
 * seules 33 vidéos couvertes par ce script (PAS les vidéos hebdomadaires
 * weeks[]/supervision[], ~120 fichiers, hors scope, voir une éventuelle
 * Phase 2 dédiée).
 *
 * LECTURE SEULE côté MongoDB et Drive (scope drive.readonly, aucune écriture
 * ni sur Drive ni en base) — seul le disque local est modifié, et uniquement
 * en mode --confirm.
 *
 * Dry-run par défaut : résout les métadonnées réelles (nom, taille) via
 * l'API Drive pour les 33 fichiers, affiche le récapitulatif (nombre, taille
 * totale, détail par fichier), n'écrit RIEN sur le disque.
 *
 * --confirm : télécharge réellement en streaming (drive.files.get avec
 * alt=media, piped vers un WriteStream — jamais chargé entièrement en
 * mémoire) dans ~/Downloads/thebridgeflow-youtube-migration/.
 *
 * Reprise idempotente : si un fichier de destination existe déjà avec
 * EXACTEMENT la taille attendue (comparée aux métadonnées Drive), il est
 * considéré déjà téléchargé et sauté — relancer le script après une
 * interruption ne re-télécharge que ce qui manque ou diffère en taille.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/drive/bulk-download-youtube-migration.js            (dry-run)
 *   node thebridgeflow-back/scripts/drive/bulk-download-youtube-migration.js --confirm   (téléchargement réel)
 * Prérequis : avoir lancé authenticate.js pour drive1 au préalable.
 */
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { google } from "googleapis";
import mongoose from "mongoose";
import { getAuthorizedClient } from "./oauthClient.js";
import Formation from "../../models/formation.model.js";
import SiteSettings from "../../models/siteSettings.model.js";

const DEST_ROOT = path.join(os.homedir(), "Downloads", "thebridgeflow-youtube-migration");
const TRAILERS_SUBDIR = "trailers";
const TESTIMONIALS_SUBDIR = "testimonials";

// Mêmes regex que thebridgeflow-front/src/constants/videoUrls.js
// (extractDriveFileId) — dupliquées ici plutôt qu'importées : ce script
// backend n'a pas accès au dossier frontend/src en usage courant (pas de
// bundler), et les URLs stockées en base sont déjà normalisées au format
// /file/d/... par l'admin (uc/open jamais rencontrés en pratique) — gardées
// en repli pour rester robuste si un futur lien collé diffère.
const DRIVE_FILE_REGEX = /\/file\/d\/([^/?#&]+)/;
const DRIVE_UC_REGEX   = /\/uc\?.*[&?]id=([^&]+)/;
const DRIVE_OPEN_REGEX = /\/open\?.*[&?]id=([^&]+)/;

function extractDriveFileId(url = "") {
  for (const regex of [DRIVE_FILE_REGEX, DRIVE_UC_REGEX, DRIVE_OPEN_REGEX]) {
    const m = url.match(regex);
    if (m) return m[1];
  }
  return null;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} Mo`;
  return `${(mb / 1024).toFixed(2)} Go`;
}

// Nom de fichier sûr pour le disque (les noms Drive des témoignages sont
// déjà propres — summer-camp8.mp4, feedback-pfe5.mp4... — mais on reste
// défensif au cas où un futur fichier contiendrait des caractères interdits
// sur Windows).
function sanitizeFilename(name) {
  return name.replace(/[/\\:*?"<>|]/g, "_");
}

// ── Collecte des 33 entrées depuis MongoDB (lecture seule) ─────────────────
async function collectEntries() {
  const formations = await Formation.find()
    .select("slug trailerVideoUrl trailerProvider")
    .lean();
  const settings = await SiteSettings.findOne().lean();

  const entries = [];

  for (const f of formations) {
    if (f.trailerProvider === "google_drive" && f.trailerVideoUrl) {
      entries.push({
        kind: "trailer",
        label: `trailer/${f.slug}`,
        url: f.trailerVideoUrl,
        subdir: TRAILERS_SUBDIR,
        // Nom de fichier basé sur le slug (stable, lisible) plutôt que le nom
        // Drive brut — certains trailers ont des noms bruts non descriptifs
        // (ex: export d'un outil tiers), le slug de formation est la
        // convention déjà utilisée partout ailleurs dans le projet.
        filenameBase: f.slug,
      });
    }
  }

  for (const t of settings?.testimonialVideos || []) {
    if (t.provider === "google_drive" && t.url) {
      entries.push({
        kind: "testimonial",
        label: `testimonial/${t.category}/${t._id}`,
        url: t.url,
        subdir: path.join(TESTIMONIALS_SUBDIR, t.category || "unknown"),
        // null = pas de nom stable côté base (pas de champ "filename" sur
        // testimonialVideoSchema) → on utilisera le nom réel du fichier Drive,
        // résolu ci-dessous via l'API, exactement comme fait pour les
        // vidéos de constants/testimonials.js (même convention
        // summer-campN.mp4 / feedback-pfeN.mp4 / feedback-formationN.mp4).
        filenameBase: null,
      });
    }
  }

  return entries;
}

// ── Résolution des métadonnées réelles (nom, taille) via l'API Drive ───────
async function resolveMetadata(drive, entries) {
  const resolved = [];
  const errors = [];

  for (const entry of entries) {
    const fileId = extractDriveFileId(entry.url);
    if (!fileId) {
      errors.push({ ...entry, error: "fileId non extrait de l'URL" });
      continue;
    }
    try {
      const res = await drive.files.get({
        fileId,
        fields: "id, name, size, mimeType",
        supportsAllDrives: true,
      });
      const size = Number(res.data.size) || 0;
      const ext = path.extname(res.data.name || "") || ".mp4";
      const filename = entry.filenameBase
        ? `${entry.filenameBase}${ext}`
        : sanitizeFilename(res.data.name);
      resolved.push({
        ...entry,
        fileId,
        driveName: res.data.name,
        size,
        destPath: path.join(DEST_ROOT, entry.subdir, filename),
      });
    } catch (err) {
      errors.push({ ...entry, fileId, error: err.message });
    }
  }

  return { resolved, errors };
}

// ── Téléchargement en streaming d'un fichier (--confirm uniquement) ────────
async function downloadFile(drive, entry) {
  fs.mkdirSync(path.dirname(entry.destPath), { recursive: true });
  const res = await drive.files.get(
    { fileId: entry.fileId, alt: "media", supportsAllDrives: true },
    { responseType: "stream" }
  );
  // Fichier temporaire puis rename atomique : évite qu'une interruption en
  // cours de stream laisse un fichier de taille incorrecte que la logique
  // de reprise idempotente (comparaison de taille) considérerait à tort
  // comme déjà téléchargé.
  const tmpPath = `${entry.destPath}.part`;
  await pipeline(res.data, fs.createWriteStream(tmpPath));
  fs.renameSync(tmpPath, entry.destPath);
}

function isAlreadyDownloaded(entry) {
  if (!fs.existsSync(entry.destPath)) return false;
  return fs.statSync(entry.destPath).size === entry.size;
}

// ── Programme principal ─────────────────────────────────────────────────────
async function main() {
  const confirm = process.argv.includes("--confirm");

  console.log("Connexion à Google Drive (drive1, readonly)...");
  const auth = await getAuthorizedClient("drive1");
  const drive = google.drive({ version: "v3", auth });

  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);

  const entries = await collectEntries();
  console.log(`${entries.length} entrée(s) google_drive trouvée(s) en base (attendu: 33 = 5 trailers + 28 témoignages).`);

  console.log("Résolution des métadonnées réelles (nom, taille) via l'API Drive...");
  const { resolved, errors } = await resolveMetadata(drive, entries);

  if (errors.length > 0) {
    console.log("");
    console.log(`⚠ ${errors.length} entrée(s) en erreur (ignorée(s) du téléchargement) :`);
    for (const e of errors) {
      console.log(`  ${e.label} — ${e.error}`);
    }
  }

  const totalBytes = resolved.reduce((sum, e) => sum + e.size, 0);
  const byKind = {
    trailer: resolved.filter((e) => e.kind === "trailer"),
    testimonial: resolved.filter((e) => e.kind === "testimonial"),
  };

  console.log("");
  console.log(`--- ${resolved.length} fichier(s) résolu(s) avec succès ---`);
  console.log(`  Trailers    : ${byKind.trailer.length}`);
  console.log(`  Témoignages : ${byKind.testimonial.length}`);
  console.log(`  Taille totale : ${formatBytes(totalBytes)}`);
  console.log(`  Destination    : ${DEST_ROOT}`);
  console.log("");
  for (const e of resolved) {
    const already = isAlreadyDownloaded(e);
    console.log(`  [${already ? "déjà présent" : "à télécharger"}] ${e.destPath} — ${formatBytes(e.size)}`);
  }

  if (!confirm) {
    console.log("");
    console.log("Dry-run — aucun fichier téléchargé. Relancer avec --confirm pour télécharger réellement.");
    await mongoose.disconnect();
    return;
  }

  console.log("");
  console.log("=== Téléchargement réel (--confirm) ===");
  let downloaded = 0, skipped = 0, failed = 0;
  for (const e of resolved) {
    if (isAlreadyDownloaded(e)) {
      skipped++;
      console.log(`  [skip, déjà présent] ${e.destPath}`);
      continue;
    }
    try {
      process.stdout.write(`  [téléchargement] ${e.destPath} (${formatBytes(e.size)})... `);
      await downloadFile(drive, e);
      downloaded++;
      console.log("OK");
    } catch (err) {
      failed++;
      console.log(`ÉCHEC — ${err.message}`);
    }
  }

  console.log("");
  console.log(`Terminé : ${downloaded} téléchargé(s), ${skipped} déjà présent(s), ${failed} échec(s).`);
  console.log(`Destination : ${DEST_ROOT}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
