/**
 * Étape 3 — Écriture en base (Cloudinary → Google Drive), à partir du
 * rapport d'inventaire déjà validé (drive-migration-report.json).
 *
 * SANS --confirm : DRY RUN uniquement — génère un aperçu complet
 * (migration-write-preview.md) de ce qui serait écrit. AUCUNE écriture Mongo.
 * AVEC --confirm : exécute réellement les mises à jour en base.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/drive/migrate.js            (dry run)
 *   node thebridgeflow-back/scripts/drive/migrate.js --confirm  (écriture réelle)
 *
 * ── Stratégie ────────────────────────────────────────────────────────────
 * Les formations cibles ont déjà des weeks[]/supervision[] en base avec du
 * contenu rédigé (content, videoTitle, duree, gratuit) — un remplacement
 * complet du tableau ($set brut, comme patchFormationWeeks) les effacerait.
 *
 * Vérifié avant d'écrire ce script : le nom de fichier Drive inventorié
 * (ex: "AI1-form-month1.mp4") correspond EXACTEMENT au basename de l'ancien
 * videoUrl local déjà en base (ex: "/videos-AI/AI1-form-month1.mp4") — pour
 * les 6 formations à mapping manuel ET Cyber/Devops. Ce script matche donc
 * chaque vidéo Drive à son entrée existante PAR NOM DE FICHIER, et ne met à
 * jour que videoUrl/thumbnail/provider/driveUrl sur l'entrée trouvée. week,
 * phase, content, videoTitle, duree, gratuit sont préservés tels quels.
 *
 * Les vidéos Drive sans entrée existante correspondante, et les entrées
 * existantes sans fichier Drive correspondant, sont signalées dans l'aperçu
 * mais jamais modifiées automatiquement (pas de content à inventer).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Formation from "../../models/formation.model.js";
import { normalizeDriveUrl } from "../../utils/driveHelper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_JSON_PATH = path.join(__dirname, "drive-migration-report.json");
const PREVIEW_MD_PATH  = path.join(__dirname, "migration-write-preview.md");

const CONFIRM = process.argv.includes("--confirm");

function basenameLower(url = "") {
  return path.posix.basename(url).toLowerCase();
}

function fieldDiffLine(label, before, after) {
  const b = before || "—";
  const a = after || "—";
  if (b === a) return `  - ${label} : \`${b}\` (inchangé)`;
  return `  - ${label} : \`${b}\` → \`${a}\``;
}

function renderEntry(u) {
  const lines = [];
  lines.push(
    `- **${u.array}[${u.idx}]** — semaine ${u.before.week}, phase "${u.before.phase}" ` +
    `(fichier Drive : \`${u.driveFile}\`)` +
    (u.typeMismatch ? " ⚠ type déduit du nom Drive incohérent avec le tableau où l'entrée existe déjà" : "")
  );
  lines.push(fieldDiffLine("videoUrl", u.before.videoUrl, u.after.videoUrl));
  lines.push(fieldDiffLine("thumbnail", u.before.thumbnail, u.after.thumbnail));
  lines.push(fieldDiffLine("provider", u.before.provider, u.after.provider));
  lines.push(fieldDiffLine("driveUrl", u.before.driveUrl, u.after.driveUrl));
  lines.push(`  - content (inchangé) : "${u.before.content}"`);
  lines.push(`  - videoTitle (inchangé) : "${u.before.videoTitle || "—"}"`);
  lines.push(`  - duree (inchangé) : "${u.before.duree || "—"}" | gratuit (inchangé) : ${u.before.gratuit}`);
  return lines.join("\n");
}

function renderFormationPreview(folder, formation, updates, noExistingEntry, untouched) {
  const lines = [];
  lines.push(`## ${folder.folder} → ${formation.title} (slug: \`${formation.slug}\`)`);
  lines.push("");
  lines.push(
    `${updates.length} entrée(s) à mettre à jour, ${noExistingEntry.length} vidéo(s) Drive sans entrée ` +
    `existante correspondante, ${untouched.length} entrée(s) existante(s) non touchée(s).`
  );
  lines.push("");

  if (updates.length) {
    lines.push("### Mises à jour");
    lines.push("");
    const sorted = [...updates].sort((a, b) => (a.array === b.array ? a.idx - b.idx : a.array.localeCompare(b.array)));
    for (const u of sorted) {
      lines.push(renderEntry(u));
      lines.push("");
    }
  }

  if (noExistingEntry.length) {
    lines.push("### ⚠ Vidéos Drive sans entrée existante correspondante (non ajoutées — pas de `content` rédigé disponible)");
    lines.push("");
    for (const v of noExistingEntry) {
      lines.push(`- \`${v.name}\` (${v.type}, semaine ${v.week ?? "?"}) — [ouvrir](${v.driveLink})`);
    }
    lines.push("");
  }

  if (untouched.length) {
    lines.push("### Entrées existantes non touchées (aucun fichier Drive correspondant trouvé)");
    lines.push("");
    for (const u of untouched) {
      lines.push(`- ${u.array}[${u.idx}] — semaine ${u.entry.week}, videoUrl actuel : \`${u.entry.videoUrl}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(REPORT_JSON_PATH)) {
    throw new Error(`Rapport introuvable : ${REPORT_JSON_PATH}. Lance d'abord inventory.js.`);
  }
  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, "utf8"));

  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  const sections = [];
  const pendingWrites = [];
  let totalUpdates = 0, totalUnmatchedDrive = 0, totalUntouched = 0;

  for (const folder of report.folders) {
    if (folder.error || folder.matchStatus !== "matched" || !folder.matchedFormation) continue;
    if (!folder.videos || folder.videos.length === 0) continue; // ex: videos-Marketing, vide

    const slug = folder.matchedFormation.slug;
    const formation = await Formation.findOne({ slug });
    if (!formation) {
      sections.push(`## ${folder.folder} → ⚠ formation "${slug}" introuvable en base (disparue depuis l'inventaire ?)\n`);
      continue;
    }

    const weeks = formation.weeks.map((w) => (w.toObject ? w.toObject() : { ...w }));
    const supervision = formation.supervision.map((w) => (w.toObject ? w.toObject() : { ...w }));

    // Index des entrées existantes par nom de fichier (basename de videoUrl)
    const existingIndex = new Map();
    weeks.forEach((w, idx) => { if (w.videoUrl) existingIndex.set(basenameLower(w.videoUrl), { array: "weeks", idx }); });
    supervision.forEach((w, idx) => { if (w.videoUrl) existingIndex.set(basenameLower(w.videoUrl), { array: "supervision", idx }); });

    const matchedBasenames = new Set();
    const updates = [];
    const noExistingEntry = [];

    for (const video of folder.videos) {
      const basename = video.name.toLowerCase();
      const found = existingIndex.get(basename);
      if (!found) {
        noExistingEntry.push(video);
        continue;
      }
      matchedBasenames.add(basename);
      const targetArray = found.array === "weeks" ? weeks : supervision;
      const entry = targetArray[found.idx];
      const before = { ...entry };

      entry.provider = "google_drive";
      entry.driveUrl = video.driveLink;
      entry.videoUrl = normalizeDriveUrl(video.driveLink, "video");
      if (video.thumbnail) {
        entry.thumbnail = normalizeDriveUrl(video.thumbnail.driveLink, "image");
      }

      const expectedArray = video.type === "encadrement" ? "supervision" : video.type === "cours" ? "weeks" : null;
      const typeMismatch = !!expectedArray && expectedArray !== found.array;

      updates.push({ array: found.array, idx: found.idx, before, after: { ...entry }, typeMismatch, driveFile: video.name });
    }

    // IMPORTANT : dérivé de existingIndex (construit AVANT la boucle de mise à
    // jour ci-dessus, sur les basenames d'origine), jamais de w.videoUrl relu
    // après coup — entry est muté en place par la boucle précédente, donc
    // relire w.videoUrl ici donnerait le NOUVEAU lien Drive et ferait
    // apparaître à tort chaque entrée mise à jour comme "non touchée" aussi
    // (bug détecté et corrigé avant validation : les deux compteurs
    // affichaient exactement le même total, ce qui a mis la puce à l'oreille).
    const untouched = [];
    for (const [basename, loc] of existingIndex.entries()) {
      if (matchedBasenames.has(basename)) continue;
      const arr = loc.array === "weeks" ? weeks : supervision;
      untouched.push({ array: loc.array, idx: loc.idx, entry: arr[loc.idx] });
    }

    totalUpdates += updates.length;
    totalUnmatchedDrive += noExistingEntry.length;
    totalUntouched += untouched.length;

    sections.push(renderFormationPreview(folder, formation, updates, noExistingEntry, untouched));

    if (CONFIRM && updates.length > 0) {
      pendingWrites.push({ formationId: formation._id, title: formation.title, weeks, supervision });
    }
  }

  const header = [
    `# ${CONFIRM ? "Écriture réelle — exécutée" : "Aperçu de l'écriture (DRY RUN — rien écrit en base)"}`,
    "",
    `Généré le ${new Date().toISOString()}`,
    "",
    "## Résumé global",
    "",
    `- ${totalUpdates} entrée(s) à mettre à jour au total`,
    `- ${totalUnmatchedDrive} vidéo(s) Drive sans entrée existante correspondante`,
    `- ${totalUntouched} entrée(s) existante(s) non touchée(s) (pas de fichier Drive trouvé)`,
    "",
  ];

  fs.writeFileSync(PREVIEW_MD_PATH, header.join("\n") + sections.join("\n"));
  console.log(`\n${CONFIRM ? "✅ Écriture" : "👁  Aperçu (dry run)"} généré : ${PREVIEW_MD_PATH}`);
  console.log(`   ${totalUpdates} entrée(s) à mettre à jour, ${totalUnmatchedDrive} sans correspondance Drive→existant, ${totalUntouched} non touchées.`);

  if (CONFIRM) {
    console.log(`\nÉcriture réelle en base pour ${pendingWrites.length} formation(s)...`);
    for (const w of pendingWrites) {
      await Formation.updateOne(
        { _id: w.formationId },
        { $set: { weeks: w.weeks, supervision: w.supervision } }
      );
      console.log(`  ✅ ${w.title}`);
    }
    console.log("\n✅ Écriture terminée.");
  } else {
    console.log("\nAucune écriture effectuée (dry run). Relance avec --confirm pour écrire réellement.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
