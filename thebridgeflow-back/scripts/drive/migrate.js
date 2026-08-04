/**
 * Étape 3 — Écriture en base (ancienne structure Drive1/Drive2 → nouveau
 * Shared Drive "Formation"), à partir du rapport d'inventaire déjà validé
 * (drive-migration-report.json).
 *
 * SANS --confirm : DRY RUN uniquement — génère un aperçu complet
 * (migration-write-preview.md) de ce qui serait écrit. AUCUNE écriture Mongo.
 * AVEC --confirm : exécute réellement les mises à jour en base.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/drive/migrate.js            (dry run)
 *   node thebridgeflow-back/scripts/drive/migrate.js --confirm  (écriture réelle)
 *
 * ── Stratégie (matching par nom de fichier exact, PAS par (type, semaine)) ──
 * La toute première migration (Cloudinary → Drive, commit b4fb545) a déjà
 * normalisé videoUrl/driveUrl en base vers des liens Drive (/preview,
 * /view?...) — le nom de fichier d'origine (ex: "AI1-form-month1.mp4") n'est
 * donc plus présent nulle part dans les documents Formation actuels. Un
 * matching par (type, semaine) déduit du nom de fichier (comme dans
 * inventory.js) a été envisagé puis écarté : il collisionne pour videos-AI
 * (AI1-4 et chatbot1-4 partagent seulement 2 valeurs "week" déduites du
 * pattern month1/month2) et échoue pour les vidéos "weeks" de videos-MERN
 * (semN.mp4 sans "form" dans le nom → type non détectable).
 *
 * La correspondance exacte fichier↔(formation, tableau, index) de la TOUTE
 * PREMIÈRE migration a été récupérée depuis l'historique Git (le rapport
 * d'origine, supprimé au commit fd16737, a été retrouvé via
 * `git show fd16737^:...migration-write-preview.md`) et figée dans
 * original-filenames.json, à côté de ce script. Les noms de fichiers Drive
 * sont inchangés par la réorganisation en Shared Drive (vérifié) — seuls les
 * ID Drive changent. Ce script matche donc chaque vidéo du nouvel inventaire
 * PAR NOM DE FICHIER EXACT contre ce mapping figé, et ne met à jour que
 * videoUrl/thumbnail/provider/driveUrl sur l'entrée trouvée. week, phase,
 * content, videoTitle, duree, gratuit sont préservés tels quels.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Formation from "../../models/formation.model.js";
import { normalizeDriveUrl, extractDriveFileId } from "../../utils/driveHelper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_JSON_PATH   = path.join(__dirname, "drive-migration-report.json");
const FILENAME_MAP_PATH  = path.join(__dirname, "original-filenames.json");
const PREVIEW_MD_PATH    = path.join(__dirname, "migration-write-preview.md");

const CONFIRM = process.argv.includes("--confirm");

const STATUS_LABEL = {
  update:        "✅ à mettre à jour",
  unchanged:      "⚪ inchangé (même ID Drive)",
  not_found:     "⚠ fichier introuvable dans l'inventaire Drive actuel",
  slot_missing:  "⚠ index absent en base (tableau plus court que prévu)",
};

function renderTable(rows) {
  const lines = [];
  lines.push("| Formation | Semaine | Type | Ancien ID Drive (en base) | Nouveau ID Drive (proposé) | Fichier Drive | Statut |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    lines.push(
      `| ${r.formation} | ${r.week} | ${r.type} | \`${r.oldId}\` | \`${r.newId}\` | ${r.filename} | ${STATUS_LABEL[r.status]} |`
    );
  }
  return lines.join("\n");
}

async function main() {
  if (!fs.existsSync(REPORT_JSON_PATH)) {
    throw new Error(`Rapport introuvable : ${REPORT_JSON_PATH}. Lance d'abord inventory.js.`);
  }
  if (!fs.existsSync(FILENAME_MAP_PATH)) {
    throw new Error(`Mapping introuvable : ${FILENAME_MAP_PATH}.`);
  }
  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, "utf8"));
  const filenameMap = JSON.parse(fs.readFileSync(FILENAME_MAP_PATH, "utf8"));

  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  // Dossier Drive actuel par slug de formation (issu de l'inventaire déjà validé).
  const folderBySlug = {};
  for (const folder of report.folders) {
    if (folder.error || folder.matchStatus !== "matched" || !folder.matchedFormation) continue;
    folderBySlug[folder.matchedFormation.slug] = folder;
  }

  const allRows = [];
  const missingSections = [];
  const pendingWrites = [];
  let totalUpdate = 0, totalUnchanged = 0, totalNotFound = 0, totalSlotMissing = 0;

  for (const [slug, arrays] of Object.entries(filenameMap)) {
    const formation = await Formation.findOne({ slug });
    if (!formation) {
      missingSections.push(`⚠ Formation "${slug}" introuvable en base (disparue depuis la migration d'origine ?) — ignorée.`);
      continue;
    }
    const folder = folderBySlug[slug];
    if (!folder) {
      missingSections.push(`⚠ Aucun dossier Drive résolu pour "${slug}" dans l'inventaire actuel — ignorée (rien mis à jour pour cette formation).`);
      continue;
    }

    const videoByFilename = new Map(folder.videos.map((v) => [v.name.toLowerCase(), v]));

    const weeks = formation.weeks.map((w) => (w.toObject ? w.toObject() : { ...w }));
    const supervision = formation.supervision.map((w) => (w.toObject ? w.toObject() : { ...w }));

    let formationUpdates = 0;

    for (const arrayName of ["weeks", "supervision"]) {
      const slots = arrays[arrayName] || [];
      const targetArray = arrayName === "weeks" ? weeks : supervision;
      const type = arrayName === "weeks" ? "cours" : "encadrement";

      slots.forEach((slot, idx) => {
        const entry = targetArray[idx];
        const row = {
          formation: formation.title,
          week: slot.week,
          type,
          filename: slot.filename,
        };

        if (!entry) {
          row.oldId = "—";
          row.newId = "—";
          row.status = "slot_missing";
          allRows.push(row);
          totalSlotMissing++;
          return;
        }

        const oldId = extractDriveFileId(entry.driveUrl || entry.videoUrl || "") || "—";
        row.oldId = oldId;

        const video = videoByFilename.get(slot.filename.toLowerCase());
        if (!video) {
          row.newId = "—";
          row.status = "not_found";
          allRows.push(row);
          totalNotFound++;
          return;
        }

        const newId = extractDriveFileId(video.driveLink) || "—";
        row.newId = newId;

        if (oldId === newId) {
          row.status = "unchanged";
          totalUnchanged++;
        } else {
          row.status = "update";
          totalUpdate++;
          formationUpdates++;
        }

        // Appliqué dans les deux cas (inchangé = ré-écriture idempotente) :
        // rafraîchit aussi thumbnail/provider même si l'ID vidéo n'a pas bougé.
        entry.provider = "google_drive";
        entry.driveUrl = video.driveLink;
        entry.videoUrl = normalizeDriveUrl(video.driveLink, "video");
        if (video.thumbnail) {
          entry.thumbnail = normalizeDriveUrl(video.thumbnail.driveLink, "image");
        }

        allRows.push(row);
      });
    }

    if (CONFIRM && formationUpdates > 0) {
      pendingWrites.push({ formationId: formation._id, title: formation.title, weeks, supervision });
    }
  }

  const lines = [];
  lines.push(`# ${CONFIRM ? "Écriture réelle — exécutée" : "Aperçu de l'écriture (DRY RUN — rien écrit en base)"}`);
  lines.push("");
  lines.push(`Généré le ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Résumé global");
  lines.push("");
  lines.push(`- ${allRows.length} ligne(s) au total (attendu : 120)`);
  lines.push(`- ${totalUpdate} entrée(s) **à mettre à jour** (nouvel ID Drive détecté)`);
  lines.push(`- ${totalUnchanged} entrée(s) inchangée(s) (même ID Drive qu'en base)`);
  lines.push(`- ${totalNotFound} entrée(s) ⚠ fichier introuvable dans l'inventaire Drive actuel`);
  lines.push(`- ${totalSlotMissing} entrée(s) ⚠ index absent en base`);
  if (missingSections.length) {
    lines.push("");
    missingSections.forEach((m) => lines.push(`- ${m}`));
  }
  lines.push("");
  lines.push("## Tableau détaillé (120 lignes attendues, une par semaine/type/formation)");
  lines.push("");
  lines.push(renderTable(allRows));
  lines.push("");

  fs.writeFileSync(PREVIEW_MD_PATH, lines.join("\n"));
  console.log(`\n${CONFIRM ? "✅ Écriture" : "👁  Aperçu (dry run)"} généré : ${PREVIEW_MD_PATH}`);
  console.log(`   ${allRows.length} ligne(s) — ${totalUpdate} à mettre à jour, ${totalUnchanged} inchangées, ${totalNotFound} introuvables, ${totalSlotMissing} index absents.`);

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
