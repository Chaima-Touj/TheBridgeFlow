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
 *   node server/scripts/drive/migrate-landing.js            (dry run)
 *   node server/scripts/drive/migrate-landing.js --confirm  (écriture réelle)
 *
 * ── Portée ──────────────────────────────────────────────────────────────
 * Seules les 28 vidéos catégorisées de report.testimonialVideos.categorized
 * sont concernées. La vidéo promo est déjà migrée (section 1 du rapport,
 * aucune action) et Img-Feedbacks/avatars restent explicitement exclus
 * (sections 3 et 4) — ni l'un ni l'autre n'est touché par ce script.
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

function renderEntry(v, idx) {
  const lines = [];
  lines.push(`- **testimonialVideos[${idx}]** — \`${v.name}\` (${v.size})`);
  lines.push(fieldLine("category", v.category));
  lines.push(fieldLine("url", v.after.url));
  lines.push(fieldLine("driveUrl", v.after.driveUrl));
  lines.push(fieldLine("provider", v.after.provider));
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
  lines.push(`- ${newEntries.length} entrée(s) à écrire dans \`SiteSettings.testimonialVideos[]\` (summer-camp: ${byCategory["summer-camp"] || 0}, pfe: ${byCategory.pfe || 0}, formation: ${byCategory.formation || 0})`);
  lines.push(
    existingCount === 0
      ? "- 0 entrée existante en base actuellement — aucune donnée ne sera écrasée."
      : `- ⚠ ${existingCount} entrée(s) **déjà présente(s)** en base — l'écriture réelle les REMPLACERA entièrement (tableau remplacé en un seul \`$set\`).`
  );
  lines.push("");
  lines.push("## Détail des entrées");
  lines.push("");
  for (const v of newEntries) {
    lines.push(renderEntry(v, newEntries.indexOf(v)));
    lines.push("");
  }

  fs.writeFileSync(PREVIEW_MD_PATH, lines.join("\n"));
  console.log(`\n${CONFIRM ? "✅ Écriture" : "👁  Aperçu (dry run)"} généré : ${PREVIEW_MD_PATH}`);
  console.log(`   ${newEntries.length} entrée(s), ${existingCount} déjà en base avant écriture.`);

  if (CONFIRM) {
    console.log("\nÉcriture réelle en base...");
    if (!settings) settings = await SiteSettings.create({});
    settings.testimonialVideos = newEntries.map((v) => v.after);
    await settings.save();
    console.log(`✅ ${newEntries.length} vidéo(s) de témoignage écrite(s) dans SiteSettings.testimonialVideos.`);
  } else {
    console.log("\nAucune écriture effectuée (dry run). Relance avec --confirm pour écrire réellement.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
