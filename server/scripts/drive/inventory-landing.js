/**
 * Étape 1 — Inventaire des contenus média de la Landing Page à migrer depuis
 * Google Drive 2 vers SiteSettings (LECTURE SEULE, DRY RUN).
 *
 * N'écrit RIEN dans MongoDB. Génère un rapport (landing-migration-report.md
 * + .json, dans ce même dossier) listant tout ce qui serait migré, avec les
 * fichiers dont la catégorie/l'usage ne peut pas être déduit du nom signalés
 * séparément pour validation manuelle — même logique que inventory.js.
 *
 * Usage : node server/scripts/drive/inventory-landing.js
 * Prérequis : avoir lancé authenticate.js pour drive2 au préalable.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import mongoose from "mongoose";
import { getAuthorizedClient } from "./oauthClient.js";
import SiteSettings from "../../models/siteSettings.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_MD_PATH   = path.join(__dirname, "landing-migration-report.md");
const REPORT_JSON_PATH = path.join(__dirname, "landing-migration-report.json");

const FOLDER_MIME = "application/vnd.google-apps.folder";

// ── Dossiers Drive 2 concernés ──────────────────────────────────────────────
const FOLDER_PROMO      = "TheBridgeFlow Video-Promo";
const FOLDER_FEEDBACKS  = "TheBridgeFlow Feedbacks";
const FOLDER_IMG_FEED   = "TheBridgeFlow Img-Feedbacks";
const FOLDER_AVATARS    = "avatars";

// ── Helpers Drive (mêmes que inventory.js) ─────────────────────────────────
async function findFolderIdByName(drive, name, parentId = "root") {
  const clauses = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ];
  if (parentId) clauses.push(`'${parentId}' in parents`);
  const res = await drive.files.list({ q: clauses.join(" and "), fields: "files(id, name)", pageSize: 10 });
  if (res.data.files.length === 0) return null;
  if (res.data.files.length > 1) {
    console.warn(`  ⚠ Plusieurs dossiers nommés "${name}" trouvés — le premier est utilisé.`);
  }
  return res.data.files[0].id;
}

async function listFilesInFolder(drive, folderId) {
  let files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, size, webViewLink)",
      pageSize: 200,
      pageToken,
    });
    files = files.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n) return "?";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function driveLinkOf(f) {
  return f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
}

// ── Déduction de catégorie pour les vidéos de "TheBridgeFlow Feedbacks" ────
// Convention déjà en place côté code (constants/testimonials.js) : préfixe
// du nom de fichier = catégorie. "feedback{n}.mp4" (sans suffixe) ne rentre
// dans aucune des 3 catégories connues — remonté comme ambigu, jamais deviné.
function categorizeFeedbackVideo(filename) {
  const lower = filename.toLowerCase();
  if (lower.startsWith("summer-camp"))       return "summer-camp";
  if (lower.startsWith("feedback-pfe"))       return "pfe";
  if (lower.startsWith("feedback-formation")) return "formation";
  return "unknown";
}

async function main() {
  console.log("Connexion à Google Drive 2...");
  const auth = await getAuthorizedClient("drive2");
  const drive = google.drive({ version: "v3", auth });

  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);
  const currentSettings = await SiteSettings.findOne().lean();

  const report = {
    generatedAt: new Date().toISOString(),
    promoVideo: null,
    testimonialVideos: { categorized: [], ambiguous: [] },
    imgFeedbacks: { files: [], note: "" },
    avatars: { files: [], note: "" },
  };

  // ── 1) Vidéo promo ─────────────────────────────────────────────────────
  console.log(`Résolution "${FOLDER_PROMO}"...`);
  const promoFolderId = await findFolderIdByName(drive, FOLDER_PROMO, "root");
  if (promoFolderId) {
    const files = await listFilesInFolder(drive, promoFolderId);
    const video = files.find((f) => f.mimeType?.startsWith("video/"));
    if (video) {
      const fileId = video.id;
      const alreadyMigrated = currentSettings?.actionVideo?.driveUrl?.includes(fileId) || false;
      report.promoVideo = {
        name: video.name,
        size: formatBytes(video.size),
        driveLink: driveLinkOf(video),
        alreadyInSiteSettings: alreadyMigrated,
        currentActionVideoDriveUrl: currentSettings?.actionVideo?.driveUrl || null,
      };
    }
  }

  // ── 2) Vidéos de témoignages ───────────────────────────────────────────
  console.log(`Résolution "${FOLDER_FEEDBACKS}"...`);
  const feedbacksFolderId = await findFolderIdByName(drive, FOLDER_FEEDBACKS, "root");
  if (feedbacksFolderId) {
    const files = await listFilesInFolder(drive, feedbacksFolderId);
    const videos = files.filter((f) => f.mimeType?.startsWith("video/"));
    for (const v of videos) {
      const category = categorizeFeedbackVideo(v.name);
      const entry = { name: v.name, size: formatBytes(v.size), category, driveLink: driveLinkOf(v) };
      if (category === "unknown") report.testimonialVideos.ambiguous.push(entry);
      else report.testimonialVideos.categorized.push(entry);
    }
  }

  // ── 3) Img-Feedbacks — probable carrousel "communauté", pas des avatars
  //      par vidéo (voir note dans le rapport) ────────────────────────────
  console.log(`Résolution "${FOLDER_IMG_FEED}"...`);
  const imgFeedFolderId = await findFolderIdByName(drive, FOLDER_IMG_FEED, "root");
  if (imgFeedFolderId) {
    const files = await listFilesInFolder(drive, imgFeedFolderId);
    report.imgFeedbacks.files = files.map((f) => ({ name: f.name, size: formatBytes(f.size), driveLink: driveLinkOf(f) }));
    report.imgFeedbacks.note =
      `❌ EXCLU de la migration (confirmé) — ${files.length} image(s) nommées img1.jpg…img${files.length}.jpg, ` +
      `déjà utilisées indépendamment par client/src/constants/screenshotTestimonials.js (carrousel "Ce que dit ` +
      `notre communauté" / TestimonialsScreenshotCarousel, FEEDBACK_IMAGE_COUNT = 29). Listé ici pour mémoire ` +
      `uniquement — aucune entrée ne sera créée dans SiteSettings pour ce dossier.`;
  }

  // ── 4) Dossier "avatars" — 2 fichiers seulement, ne correspond pas à
  //      "un avatar par carte témoignage" ────────────────────────────────
  console.log(`Résolution "${FOLDER_AVATARS}"...`);
  const avatarsFolderId = await findFolderIdByName(drive, FOLDER_AVATARS, "root");
  if (avatarsFolderId) {
    const files = await listFilesInFolder(drive, avatarsFolderId);
    report.avatars.files = files.map((f) => ({ name: f.name, size: formatBytes(f.size), driveLink: driveLinkOf(f) }));
    report.avatars.note =
      `❌ EXCLU de la migration (confirmé) — ${files.length} fichier(s) génériques (${files.map((f) => f.name).join(", ")}), ` +
      `non utilisés actuellement sur la Landing Page. Listé ici pour mémoire uniquement — aucune entrée ne sera ` +
      `créée dans SiteSettings.communityAvatars pour ce dossier.`;
  }

  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD_PATH, renderMarkdown(report));

  console.log(`\n✅ Rapport généré (aucune écriture en base) :`);
  console.log(`   ${REPORT_MD_PATH}`);
  console.log(`   ${REPORT_JSON_PATH}`);

  await mongoose.disconnect();
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Rapport d'inventaire Landing Page — Google Drive 2 → SiteSettings (dry run)");
  lines.push("");
  lines.push(`Généré le ${report.generatedAt}`);
  lines.push("");

  // ── Promo ──────────────────────────────────────────────────────────────
  lines.push("## 1. Vidéo promo (\"Découvrez TheBridgeFlow en action\")");
  lines.push("");
  if (report.promoVideo) {
    lines.push(`- Fichier Drive : \`${report.promoVideo.name}\` (${report.promoVideo.size})`);
    lines.push(`- Lien : ${report.promoVideo.driveLink}`);
    if (report.promoVideo.alreadyInSiteSettings) {
      lines.push(`- ✅ **Déjà migré** — identique à \`SiteSettings.actionVideo\` actuel (même ID de fichier). Aucune action nécessaire.`);
    } else {
      lines.push(`- ⚠ Différent de \`SiteSettings.actionVideo\` actuel (\`${report.promoVideo.currentActionVideoDriveUrl || "vide"}\`) — à confirmer avant mise à jour.`);
    }
  } else {
    lines.push("⚠ Dossier ou fichier introuvable.");
  }
  lines.push("");

  // ── Testimonial videos ─────────────────────────────────────────────────
  const { categorized, ambiguous } = report.testimonialVideos;
  lines.push("## 2. Vidéos de témoignages (\"TheBridgeFlow Feedbacks\")");
  lines.push("");
  lines.push(`- ${categorized.length} vidéo(s) avec catégorie déduite du nom de fichier (summer-camp / pfe / formation)`);
  lines.push(
    ambiguous.length === 0
      ? "- 0 vidéo ambiguë — les 10 fichiers `feedback{n}.mp4` sans préfixe de catégorie ont été supprimés de Drive (doublons confirmés), plus aucune trace dans cet inventaire"
      : `- ${ambiguous.length} vidéo(s) **ambiguë(s)** — nom sans préfixe de catégorie, à assigner manuellement`
  );
  lines.push("");

  lines.push("### Catégorisées");
  lines.push("");
  lines.push("| Fichier | Catégorie | Taille | Lien |");
  lines.push("|---|---|---|---|");
  for (const v of categorized) {
    lines.push(`| ${v.name} | ${v.category} | ${v.size} | [ouvrir](${v.driveLink}) |`);
  }
  lines.push("");

  if (ambiguous.length > 0) {
    lines.push("### ⚠ Ambiguës (catégorie non déductible du nom — validation manuelle requise)");
    lines.push("");
    lines.push("| Fichier | Taille | Lien |");
    lines.push("|---|---|---|");
    for (const v of ambiguous) {
      lines.push(`| ${v.name} | ${v.size} | [ouvrir](${v.driveLink}) |`);
    }
    lines.push("");
  }

  // ── Img-Feedbacks ──────────────────────────────────────────────────────
  lines.push("## 3. \"TheBridgeFlow Img-Feedbacks\" — exclu de la migration (confirmé)");
  lines.push("");
  lines.push(report.imgFeedbacks.note);
  lines.push("");
  lines.push(`${report.imgFeedbacks.files.length} fichier(s) trouvé(s) : ${report.imgFeedbacks.files.map((f) => f.name).join(", ")}`);
  lines.push("");

  // ── Avatars ────────────────────────────────────────────────────────────
  lines.push("## 4. Dossier \"avatars\" — exclu de la migration (confirmé)");
  lines.push("");
  lines.push(report.avatars.note);
  lines.push("");
  lines.push("| Fichier | Taille | Lien |");
  lines.push("|---|---|---|");
  for (const f of report.avatars.files) {
    lines.push(`| ${f.name} | ${f.size} | [ouvrir](${f.driveLink}) |`);
  }
  lines.push("");

  return lines.join("\n");
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
