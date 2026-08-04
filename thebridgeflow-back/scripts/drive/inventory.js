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
 * Usage : node thebridgeflow-back/scripts/drive/inventory.js
 * Prérequis : avoir lancé authenticate.js pour drive1 au préalable (drive2
 * n'est plus utilisé — tout le contenu vidéo a été réorganisé dans un
 * unique Shared Drive "Formation" sur drive1).
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

// ── Structure des dossiers (Shared Drive "Formation", drive1) ──────────────
// Tout le contenu (vidéos + miniatures) vit désormais dans un unique Shared
// Drive nommé "Formation" sur le compte drive1 — confirmé via l'API
// (drive.drives.get) : l'ID commence par "0A", format réservé aux Shared
// Drives, jamais aux dossiers "My Drive" classiques. D'où supportsAllDrives/
// includeItemsFromAllDrives sur tous les appels Drive de ce script (requis
// par l'API pour lister/lire le contenu d'un Shared Drive).
const FORMATION_DRIVE_ID = "0AOffyQncQYm5Uk9PVA";

const VIDEO_FOLDERS = [
  "videos-AI", "videos-Angular", "videos-Bi", "videos-Cyber", "videos-Devops",
  "videos-Flutter", "videos-Iot", "videos-Marketing", "videos-MERN",
];

// Les dossiers de miniatures ne sont PAS directement à la racine de
// "Formation" : 8 des 9 vivent dans un sous-dossier "Thumbs-videos" (vérifié
// via l'API — structure équivalente à l'ancien dossier "imgs" sur drive2,
// juste renommée et déplacée dans le nouveau Shared Drive).
const THUMBS_VIDEOS_PARENT_FOLDER = "Thumbs-videos";

// Mapping dossier vidéo → dossier miniatures. Pas de règle générique fiable
// (ex: Devops → dev-thumbs n'est qu'une hypothèse) donc écrit explicitement.
// null = aucun dossier thumbs identifié pour ce dossier vidéo.
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
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
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
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
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

// Priorité 1.5 — repli pour les fichiers sans "form"/"enca(d)" dans le nom
// (type non détectable par parseVideoFilename, donc priorité 1 inapplicable
// puisqu'elle exige videoType !== "unknown") mais où vidéo et miniature
// partagent exactement les mêmes mots, dans un ordre différent (constaté sur
// videos-MERN : vidéo "sem5-backend.mp4" vs miniature
// "backend-sem5-thumb.jpg"). Comparaison par ensemble de tokens (insensible
// à l'ordre), après retrait du mot générique "thumb" — plus strict qu'une
// simple inclusion de sous-chaîne (priorité 2 ci-dessous), donc essayé avant.
function nameTokenSet(filename) {
  return new Set(
    stripExt(filename).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && t !== "thumb")
  );
}

function sameTokenSet(a, b) {
  if (a.size === 0 || a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
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

  const videoTokens = nameTokenSet(videoFile.name);
  const byTokenSet = thumbFiles.find((t) => sameTokenSet(videoTokens, nameTokenSet(t.name)));
  if (byTokenSet) return byTokenSet;

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
  console.log("Connexion au compte Google Drive (drive1)...");
  const authDrive1 = await getAuthorizedClient("drive1");
  const drive1 = google.drive({ version: "v3", auth: authDrive1 });

  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);
  const formations = await Formation.find().select("title slug").lean();
  console.log(`  ${formations.length} formation(s) trouvée(s) en base.`);

  const report = { generatedAt: new Date().toISOString(), folders: [] };

  // Résolution des dossiers thumbs (sous-dossier "Thumbs-videos" du Shared
  // Drive "Formation"), une seule fois.
  console.log(`Résolution des dossiers de miniatures (${THUMBS_VIDEOS_PARENT_FOLDER})...`);
  const thumbsParentId = await findFolderIdByName(drive1, THUMBS_VIDEOS_PARENT_FOLDER, FORMATION_DRIVE_ID);
  const thumbsFolderIds = {};
  for (const [videoFolder, thumbsInfo] of Object.entries(THUMBS_FOLDER_MAP)) {
    if (!thumbsInfo) continue;
    thumbsFolderIds[videoFolder] = thumbsParentId
      ? await findFolderIdByName(drive1, thumbsInfo.name, thumbsParentId)
      : null;
  }

  async function processFolder(folderName) {
    console.log(`  → ${folderName}`);
    const folderId = await findFolderIdByName(drive1, folderName, FORMATION_DRIVE_ID);
    if (!folderId) {
      report.folders.push({ drive: "drive1", folder: folderName, error: "Dossier introuvable sur Drive" });
      return;
    }

    const files = await listFilesInFolder(drive1, folderId);
    const videoFiles = files.filter((f) => f.mimeType?.startsWith("video/"));

    const thumbFolderId = thumbsFolderIds[folderName] || null;
    const thumbsConfidence = THUMBS_FOLDER_MAP[folderName]?.confidence || null;
    const thumbFiles = thumbFolderId ? await listFilesInFolder(drive1, thumbFolderId) : [];

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
      drive: "drive1",
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

  console.log(`Inventaire du Shared Drive "Formation" (${FORMATION_DRIVE_ID})...`);
  for (const folder of VIDEO_FOLDERS) {
    await processFolder(folder);
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
