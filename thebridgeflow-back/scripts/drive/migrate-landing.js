/**
 * Étape 3 — Écriture en base des vidéos de témoignages Landing Page
 * (Google Drive 2 → SiteSettings.testimonialVideos[]), à partir du rapport
 * d'inventaire déjà validé (landing-migration-report.json).
 *
 * SANS --confirm : DRY RUN uniquement — génère un aperçu complet
 * (landing-migration-write-preview.md) de ce qui serait écrit. AUCUNE
 * écriture Mongo.
 * AVEC --confirm : exécute réellement l'écriture en base.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/drive/migrate-landing.js            (dry run)
 *   node thebridgeflow-back/scripts/drive/migrate-landing.js --confirm  (écriture réelle)
 *
 * ── Portée ──────────────────────────────────────────────────────────────
 * Vidéo promo (SiteSettings.actionVideo) : mise à jour à partir du fichier
 * trouvé dans "Formation" / TheBridgeFlow Video-Promo, source de vérité
 * même si son ID Drive diffère de celui déjà en base (fichier remplacé lors
 * de la réorganisation Drive). Vidéos de témoignages : les 28 vidéos
 * catégorisées de report.testimonialVideos.categorized. Img-Feedbacks et
 * avatars restent explicitement exclus (sections 3 et 4 du rapport
 * d'inventaire) — ni l'un ni l'autre n'est touché par ce script.
 *
 * Contrairement à migrate.js (Formation), SiteSettings.testimonialVideos
 * est actuellement vide (nouveau champ) : il n'y a pas de contenu rédigé
 * existant à préserver par entrée, donc ce script REMPLACE tout le tableau
 * en un seul $set. Le dry run affiche explicitement le nombre d'entrées
 * déjà présentes en base pour qu'aucune donnée ne soit écrasée à l'aveugle.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import SiteSettings from "../../models/siteSettings.model.js";
import { normalizeDriveUrl } from "../../utils/driveHelper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_JSON_PATH = path.join(__dirname, "landing-migration-report.json");
const PREVIEW_MD_PATH  = path.join(__dirname, "landing-migration-write-preview.md");

const CONFIRM = process.argv.includes("--confirm");

function fieldLine(label, value) {
  return `  - ${label} : \`${value || "—"}\``;
}

function fieldDiffLine(label, before, after) {
  const b = before || "—";
  const a = after || "—";
  if (b === a) return `  - ${label} : \`${b}\` (inchangé)`;
  return `  - ${label} : \`${b}\` → \`${a}\``;
}

function renderEntry(v, idx) {
  const lines = [];
  lines.push(`- **testimonialVideos[${idx}]** — \`${v.name}\` (${v.size})`);
  lines.push(fieldLine("category", v.category));
  lines.push(fieldLine("url", v.after.url));
  lines.push(fieldLine("driveUrl", v.after.driveUrl));
  lines.push(fieldLine("provider", v.after.provider));
  return lines.join("\n");
}

function renderPromoSection(promo) {
  const lines = [];
  lines.push("## 1. Vidéo promo (`SiteSettings.actionVideo`)");
  lines.push("");
  if (!promo) {
    lines.push("⚠ Aucune vidéo promo trouvée dans le rapport d'inventaire (`TheBridgeFlow Video-Promo`) — `actionVideo` non touché.");
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`Fichier Drive : \`${promo.driveFile}\` (dossier "Formation" / TheBridgeFlow Video-Promo)`);
  lines.push("");
  lines.push(fieldDiffLine("url", promo.before.url, promo.after.url));
  lines.push(fieldDiffLine("driveUrl", promo.before.driveUrl, promo.after.driveUrl));
  lines.push(fieldDiffLine("provider", promo.before.provider, promo.after.provider));
  lines.push(`  - thumbnail : \`${promo.before.thumbnail || "—"}\` (inchangé — non fourni par l'inventaire)`);
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(REPORT_JSON_PATH)) {
    throw new Error(`Rapport introuvable : ${REPORT_JSON_PATH}. Lance d'abord inventory-landing.js.`);
  }
  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, "utf8"));
  const categorized = report.testimonialVideos?.categorized || [];

  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  let settings = await SiteSettings.findOne();
  const existingCount = settings?.testimonialVideos?.length || 0;

  // ── Vidéo promo — le dossier "Formation" (Video-Promo) est désormais la
  // source de vérité, même quand l'ID Drive diffère de celui déjà en base
  // (cas constaté à l'inventaire : fichier remplacé lors de la
  // réorganisation Drive). thumbnail existant préservé tel quel : l'inventaire
  // ne résout pas de miniature pour la promo.
  const promoBefore = {
    url: settings?.actionVideo?.url || "",
    driveUrl: settings?.actionVideo?.driveUrl || "",
    provider: settings?.actionVideo?.provider || "",
    thumbnail: settings?.actionVideo?.thumbnail || "",
  };
  const promoUpdate = report.promoVideo
    ? {
        driveFile: report.promoVideo.name,
        before: promoBefore,
        after: {
          url: normalizeDriveUrl(report.promoVideo.driveLink, "video"),
          provider: "google_drive",
          driveUrl: report.promoVideo.driveLink,
          thumbnail: promoBefore.thumbnail,
        },
      }
    : null;

  const newEntries = categorized.map((v) => ({
    name: v.name,
    size: v.size,
    category: v.category,
    after: {
      url: normalizeDriveUrl(v.driveLink, "video"),
      provider: "google_drive",
      driveUrl: v.driveLink,
      thumbnail: "",
      category: v.category,
    },
  }));

  const byCategory = newEntries.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push(`# ${CONFIRM ? "Écriture réelle — exécutée" : "Aperçu de l'écriture (DRY RUN — rien écrit en base)"}`);
  lines.push("");
  lines.push(`Généré le ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Résumé global");
  lines.push("");
  lines.push(
    promoUpdate
      ? `- \`SiteSettings.actionVideo\` : ${promoUpdate.before.driveUrl === promoUpdate.after.driveUrl ? "inchangé (même fichier Drive)" : "à mettre à jour (nouveau fichier Drive détecté)"}`
      : "- ⚠ Aucune vidéo promo trouvée à l'inventaire — `actionVideo` non touché"
  );
  lines.push(`- ${newEntries.length} entrée(s) à écrire dans \`SiteSettings.testimonialVideos[]\` (summer-camp: ${byCategory["summer-camp"] || 0}, pfe: ${byCategory.pfe || 0}, formation: ${byCategory.formation || 0})`);
  lines.push(
    existingCount === 0
      ? "- 0 entrée existante en base actuellement — aucune donnée ne sera écrasée."
      : `- ⚠ ${existingCount} entrée(s) **déjà présente(s)** en base — l'écriture réelle les REMPLACERA entièrement (tableau remplacé en un seul \`$set\`).`
  );
  lines.push("");
  lines.push(renderPromoSection(promoUpdate));
  lines.push("## 2. Vidéos de témoignages (`SiteSettings.testimonialVideos[]`)");
  lines.push("");
  for (const v of newEntries) {
    lines.push(renderEntry(v, newEntries.indexOf(v)));
    lines.push("");
  }

  fs.writeFileSync(PREVIEW_MD_PATH, lines.join("\n"));
  console.log(`\n${CONFIRM ? "✅ Écriture" : "👁  Aperçu (dry run)"} généré : ${PREVIEW_MD_PATH}`);
  console.log(`   ${newEntries.length} entrée(s) de témoignage, ${existingCount} déjà en base avant écriture.`);
  console.log(`   Vidéo promo : ${promoUpdate ? (promoUpdate.before.driveUrl === promoUpdate.after.driveUrl ? "inchangée" : "à mettre à jour") : "non trouvée"}.`);

  if (CONFIRM) {
    console.log("\nÉcriture réelle en base...");
    if (!settings) settings = await SiteSettings.create({});
    if (promoUpdate) settings.actionVideo = promoUpdate.after;
    settings.testimonialVideos = newEntries.map((v) => v.after);
    await settings.save();
    console.log(`✅ ${newEntries.length} vidéo(s) de témoignage écrite(s) dans SiteSettings.testimonialVideos.`);
    if (promoUpdate) console.log("✅ Vidéo promo mise à jour dans SiteSettings.actionVideo.");
  } else {
    console.log("\nAucune écriture effectuée (dry run). Relance avec --confirm pour écrire réellement.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
