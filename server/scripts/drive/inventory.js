/**
 * Étape 2 — Inventaire complet (LECTURE SEULE, DRY RUN).
 *
 * N'écrit RIEN dans MongoDB (Formation.find() uniquement). Ne modifie RIEN
 * sur Google Drive (scope drive.readonly). Génère un rapport
 * (drive-migration-report.md + .json, dans ce même dossier) listant, par
 * dossier vidéo : les fichiers trouvés, leur type (cours/encadrement) déduit
 * du nom, leur miniature associée si trouvée, leur lien Drive, et une
 * proposition de correspondance avec une formation existante en base.
 *
 * Usage : node server/scripts/drive/inventory.js
 * Prérequis : avoir lancé authenticate.js pour drive1 ET drive2 au préalable.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import mongoose from "mongoose";
import { getAuthorizedClient } from "./oauthClient.js";
import Formation from "../../models/formation.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_MD_PATH   = path.join(__dirname, "drive-migration-report.md");
const REPORT_JSON_PATH = path.join(__dirname, "drive-migration-report.json");

const FOLDER_MIME = "application/vnd.google-apps.folder";

// ── Structure des dossiers (telle que décrite par Chaima) ──────────────────
const DRIVE1_ROOT_FOLDER = "TheBridgeFlow Videos";
const DRIVE1_VIDEO_FOLDERS = [
  "videos-AI", "videos-Cyber", "videos-Devops", "videos-Flutter", "videos-Marketing", "videos-MERN",
];

// Drive 2 : pas de dossier racine dédié aux vidéos — les dossiers vivent
// directement à la racine du compte, tout comme "imgs".
const DRIVE2_VIDEO_FOLDERS = ["videos-Angular", "videos-Bi", "videos-Iot"];
const DRIVE2_THUMBS_PARENT_FOLDER = "imgs";

// Mapping dossier vidéo → dossier miniatures (Drive 2). Pas de règle
// générique fiable (ex: Devops → dev-thumbs n'est qu'une hypothèse) donc
// écrit explicitement. null = aucun dossier thumbs identifié dans la liste
// fournie par Chaima pour ce dossier vidéo.
const THUMBS_FOLDER_MAP = {
  "videos-AI":       { name: "ai-thumbs",      confidence: "certain" },
  "videos-Cyber":     { name: "cyber-thumbs",   confidence: "certain" },
  "videos-Devops":    { name: "dev-thumbs",     confidence: "guessed" }, // "Devops" vs "dev" — à confirmer
  "videos-Flutter":   { name: "flutter-thumbs", confidence: "certain" },
  "videos-Marketing": null, // aucun dossier thumbs correspondant listé
  "videos-MERN":      { name: "mern-thumbs",    confidence: "certain" },
  "videos-Angular":   { name: "angular-thumbs", confidence: "certain" },
  "videos-Bi":        { name: "bi-thumbs",      confidence: "certain" },
  "videos-Iot":       { name: "iot-thumbs",     confidence: "certain" },
};

// Dossiers où plusieurs vidéos distinctes partagent le même (type, semaine/mois)
// — ex: videos-AI a AI1/AI2/AI3/AI4 toutes en "month1", et chatbot1-4 toutes en
// "month2". Sans identifiant supplémentaire, le matching par (type, semaine)
// collisionne et rattache les 4 vidéos au même thumbnail. Scopé explicitement
// à ces dossiers (pas un comportement générique) pour ne pas changer le
// matching des dossiers qui fonctionnent déjà correctement sans ça.
const PREFIX_MATCH_FOLDERS = new Set(["videos-AI"]);

// Table de correspondance manuelle dossier vidéo → slug de formation,
// vérifiée EN PRIORITÉ avant l'algorithme de similarité automatique — pour
// les dossiers où le nom ne peut pas matcher par similarité de tokens bruts
// (ex: "AI" ne partage aucun mot avec "Artificial Intelligence (IA Chatbot)").
// Tous les slugs vérifiés en base (Formation.findOne({ title: ... })) avant
// ajout — jamais devinés.
const FOLDER_TO_FORMATION_SLUG = {
  "videos-AI":      "ai",
  "videos-Flutter": "mobile-flutter",
  "videos-MERN":    "mern-stack",
  "videos-Angular": "fullstack-spring-angular",
  "videos-Bi":      "bi",
  "videos-Iot":     "iot",
};

// ── Helpers Drive ────────────────────────────────────────────────────────
async function findFolderIdByName(drive, name, parentId = "root") {
  const clauses = [
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ];
  if (parentId) clauses.push(`'${parentId}' in parents`);
  const res = await drive.files.list({
    q: clauses.join(" and "),
    fields: "files(id, name)",
    pageSize: 10,
  });
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

// ── Parsing du nom de fichier vidéo ─────────────────────────────────────
function parseVideoFilename(filename) {
  const lower = filename.toLowerCase();

  let type = "unknown";
  if (/enca|encad/.test(lower)) type = "encadrement";
  else if (/form/.test(lower)) type = "cours";

  let week = null;
  const semMatch    = lower.match(/sem(\d+)/);
  const monthMatch  = lower.match(/month(\d+)/);
  const levelMatch  = lower.match(/level(\d+)/);
  // Dernier nombre isolé avant l'extension (ex: "encad1.mp4" → 1) — filet de
  // sécurité quand aucun des motifs ci-dessus ne matche.
  const trailingDigit = lower.match(/(\d+)(?=[^a-z\d]*\.[a-z0-9]+$)/);

  if (semMatch)        week = Number(semMatch[1]);
  else if (monthMatch) week = Number(monthMatch[1]);
  else if (levelMatch) week = Number(levelMatch[1]);
  else if (trailingDigit) week = Number(trailingDigit[1]);

  return { type, week };
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n) return "?";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}

// Réutilisable pour tout dossier, pas seulement videos-Bi : certains dossiers
// nomment leurs miniatures dans un ordre de mots différent des vidéos (ex:
// videos-Bi — vidéo "sem1-level1-form.mp4" vs thumb "sem1-form-lev1-thumb.jpg" :
// même sémantique, ordre différent, "level" vs "lev"). Une comparaison par
// inclusion de sous-chaîne ne matche jamais dans ce cas.
//
// Priorité 1 : correspondance par (semaine, type) plutôt que par texte brut.
// parseVideoFilename() cherche déjà ses motifs (semN, enca/encad/form)
// n'importe où dans la chaîne — insensible à l'ordre des mots — donc
// réutilisable tel quel sur les noms de miniatures, sans code dédié à Bi.
// "encad" et "enca" sont déjà normalisés au même type "encadrement" par
// parseVideoFilename (enca est un préfixe de encad, le même regex matche les
// deux), donc cette correspondance fonctionne même si la vidéo dit "encad"
// et la miniature "enca" (incohérence source relevée sur videos-Bi sem1-4).
//
// Priorité 2 (repli) : inclusion de sous-chaîne, pour les dossiers où thumb
// et vidéo partagent littéralement le même nom de base (comportement
// inchangé par rapport à avant pour ces cas-là).
//
// Préfixe de série (ex: "ai1", "chatbot3") — extrait le premier token
// lettres+chiffres en tout début de nom, avant un tiret (ex: "AI1-enca-
// month1.mp4" → "ai1", "chatbot4-form-month2-thumb.jpg" → "chatbot4"). Utilisé
// uniquement pour les dossiers listés dans PREFIX_MATCH_FOLDERS, où plusieurs
// vidéos distinctes partagent le même (type, mois) — sans ça elles
// collisionnaient toutes sur le même thumbnail (le premier trouvé).
function extractSeriesPrefix(filename) {
  const base = stripExt(filename).toLowerCase();
  const m = base.match(/^([a-z]+\d+)-/);
  return m ? m[1] : null;
}

function findMatchingThumb(videoFile, thumbFiles, folderName) {
  const { type: videoType, week: videoWeek } = parseVideoFilename(videoFile.name);
  const requirePrefix = PREFIX_MATCH_FOLDERS.has(folderName);
  const videoPrefix = requirePrefix ? extractSeriesPrefix(videoFile.name) : null;

  if (videoType !== "unknown" && videoWeek !== null) {
    const byWeekAndType = thumbFiles.find((t) => {
      const thumbParsed = parseVideoFilename(t.name);
      if (thumbParsed.type !== videoType || thumbParsed.week !== videoWeek) return false;
      if (requirePrefix && videoPrefix) return extractSeriesPrefix(t.name) === videoPrefix;
      return true;
    });
    if (byWeekAndType) return byWeekAndType;
  }

  const v = stripExt(videoFile.name).toLowerCase();
  return (
    thumbFiles.find((t) => stripExt(t.name).toLowerCase() === v) ||
    thumbFiles.find((t) => t.name.toLowerCase().includes(v)) ||
    thumbFiles.find((t) => v.includes(stripExt(t.name).toLowerCase())) ||
    null
  );
}

// ── Correspondance dossier vidéo ↔ formation existante ──────────────────
function tokenize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}

function similarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.max(ta.size, tb.size);
}

function matchFormation(folderName, formations) {
  // Mapping manuel vérifié en priorité — avant toute similarité automatique.
  const manualSlug = FOLDER_TO_FORMATION_SLUG[folderName];
  if (manualSlug) {
    const formation = formations.find((f) => f.slug === manualSlug);
    if (formation) {
      const entry = { formation, score: 1 };
      return { status: "matched", best: entry, top3: [entry], source: "manual" };
    }
    console.warn(`  ⚠ FOLDER_TO_FORMATION_SLUG["${folderName}"] = "${manualSlug}" introuvable en base — repli sur la similarité automatique.`);
  }

  const cleaned = folderName.replace(/^videos-/i, "");
  const scored = formations
    .map((f) => ({ formation: f, score: similarity(cleaned, f.title) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const status = !best || best.score === 0 ? "not_found" : best.score >= 0.5 ? "matched" : "ambiguous";
  return { status, best, top3: scored.slice(0, 3), source: "auto" };
}

// ── Programme principal ──────────────────────────────────────────────────
async function main() {
  console.log("Connexion aux 2 comptes Google Drive...");
  const authDrive1 = await getAuthorizedClient("drive1");
  const authDrive2 = await getAuthorizedClient("drive2");
  const drive1 = google.drive({ version: "v3", auth: authDrive1 });
  const drive2 = google.drive({ version: "v3", auth: authDrive2 });

  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);
  const formations = await Formation.find().select("title slug").lean();
  console.log(`  ${formations.length} formation(s) trouvée(s) en base.`);

  const report = { generatedAt: new Date().toISOString(), folders: [] };

  // Résolution des dossiers thumbs (Drive 2), une seule fois.
  console.log("Résolution des dossiers de miniatures (Drive 2 / imgs)...");
  const thumbsParentId = await findFolderIdByName(drive2, DRIVE2_THUMBS_PARENT_FOLDER, "root");
  const thumbsFolderIds = {};
  for (const [videoFolder, thumbsInfo] of Object.entries(THUMBS_FOLDER_MAP)) {
    if (!thumbsInfo) continue;
    thumbsFolderIds[videoFolder] = thumbsParentId
      ? await findFolderIdByName(drive2, thumbsInfo.name, thumbsParentId)
      : null;
  }

  async function processFolder(drive, driveLabel, folderName, parentId) {
    console.log(`  → ${driveLabel}/${folderName}`);
    const folderId = await findFolderIdByName(drive, folderName, parentId);
    if (!folderId) {
      report.folders.push({ drive: driveLabel, folder: folderName, error: "Dossier introuvable sur Drive" });
      return;
    }

    const files = await listFilesInFolder(drive, folderId);
    const videoFiles = files.filter((f) => f.mimeType?.startsWith("video/"));

    const thumbFolderId = thumbsFolderIds[folderName] || null;
    const thumbsConfidence = THUMBS_FOLDER_MAP[folderName]?.confidence || null;
    const thumbFiles = thumbFolderId ? await listFilesInFolder(drive2, thumbFolderId) : [];

    const videos = videoFiles.map((f) => {
      const { type, week } = parseVideoFilename(f.name);
      const thumb = findMatchingThumb(f, thumbFiles, folderName);
      return {
        name: f.name,
        size: formatBytes(f.size),
        type,
        week,
        parentFolder: folderName,
        driveLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        thumbnail: thumb
          ? { name: thumb.name, driveLink: thumb.webViewLink || `https://drive.google.com/file/d/${thumb.id}/view` }
          : null,
      };
    });

    const { status, best, top3, source } = matchFormation(folderName, formations);

    report.folders.push({
      drive: driveLabel,
      folder: folderName,
      videoCount: videos.length,
      thumbsFolderResolved: !!thumbFolderId,
      thumbsConfidence,
      matchStatus: status,
      matchSource: source,
      matchedFormation: status !== "not_found"
        ? { title: best.formation.title, slug: best.formation.slug, score: Number(best.score.toFixed(2)) }
        : null,
      candidateFormations: status === "ambiguous"
        ? top3.map((s) => ({ title: s.formation.title, score: Number(s.score.toFixed(2)) }))
        : undefined,
      videos,
    });
  }

  console.log(`Résolution du dossier racine Drive 1 "${DRIVE1_ROOT_FOLDER}"...`);
  const drive1RootId = await findFolderIdByName(drive1, DRIVE1_ROOT_FOLDER, "root");
  if (!drive1RootId) {
    console.warn(`  ⚠ Dossier racine "${DRIVE1_ROOT_FOLDER}" introuvable à la racine de Drive 1 — recherche globale en secours.`);
  }

  console.log("Inventaire Drive 1...");
  for (const folder of DRIVE1_VIDEO_FOLDERS) {
    await processFolder(drive1, "drive1", folder, drive1RootId || null);
  }

  console.log("Inventaire Drive 2...");
  for (const folder of DRIVE2_VIDEO_FOLDERS) {
    await processFolder(drive2, "drive2", folder, "root");
  }

  fs.writeFileSync(REPORT_JSON_PATH, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD_PATH, renderMarkdown(report));

  console.log(`\n✅ Rapport généré (aucune écriture en base) :`);
  console.log(`   ${REPORT_MD_PATH}`);
  console.log(`   ${REPORT_JSON_PATH}`);

  await mongoose.disconnect();
}

function renderMarkdown(report) {
  const matched   = report.folders.filter((f) => f.matchStatus === "matched");
  const ambiguous = report.folders.filter((f) => f.matchStatus === "ambiguous");
  const notFound  = report.folders.filter((f) => f.matchStatus === "not_found" || f.error);

  const lines = [];
  lines.push("# Rapport d'inventaire Google Drive → MongoDB (dry run, rien écrit en base)");
  lines.push("");
  lines.push(`Généré le ${report.generatedAt}`);
  lines.push("");
  lines.push("## Résumé");
  lines.push("");
  lines.push(`- ${matched.length} dossier(s) avec correspondance claire`);
  lines.push(`- ${ambiguous.length} dossier(s) ambigu(s) — à valider manuellement`);
  lines.push(`- ${notFound.length} dossier(s) sans correspondance / erreur`);
  lines.push("");

  function renderFolder(f) {
    lines.push(`### ${f.drive} / ${f.folder}`);
    lines.push("");
    if (f.error) {
      lines.push(`⚠ ${f.error}`);
      lines.push("");
      return;
    }
    const matchLabel = f.matchStatus === "matched" ? "Formation détectée" : "Meilleure candidate";
    const sourceTag = f.matchSource === "manual" ? " (mapping manuel)" : "";
    lines.push(`- ${matchLabel} : **${f.matchedFormation?.title || "—"}** (slug: \`${f.matchedFormation?.slug || "—"}\`, score ${f.matchedFormation?.score ?? "—"})${sourceTag}`);
    if (f.candidateFormations) {
      lines.push(`- Autres candidats : ${f.candidateFormations.map((c) => `${c.title} (${c.score})`).join(", ")}`);
    }
    lines.push(`- Dossier miniatures résolu : ${f.thumbsFolderResolved ? "oui" : "non"}${f.thumbsConfidence === "guessed" ? " (mapping non confirmé — voir THUMBS_FOLDER_MAP)" : ""}`);
    lines.push(`- ${f.videoCount} vidéo(s)`);
    lines.push("");
    lines.push("| Fichier | Type | Semaine | Taille | Miniature | Lien Drive |");
    lines.push("|---|---|---|---|---|---|");
    for (const v of f.videos) {
      lines.push(`| ${v.name} | ${v.type} | ${v.week ?? "?"} | ${v.size} | ${v.thumbnail ? "✅ " + v.thumbnail.name : "❌"} | [ouvrir](${v.driveLink}) |`);
    }
    lines.push("");
  }

  lines.push("## Correspondances trouvées");
  lines.push("");
  matched.forEach(renderFolder);

  lines.push("## Correspondances ambiguës");
  lines.push("");
  ambiguous.forEach(renderFolder);

  lines.push("## Non trouvées / erreurs");
  lines.push("");
  notFound.forEach(renderFolder);

  return lines.join("\n");
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
