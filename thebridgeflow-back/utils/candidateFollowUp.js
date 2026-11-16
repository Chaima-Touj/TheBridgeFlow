import path from "node:path";

/* Helpers PURS (aucun accès base de données) de l'espace admin
   « Candidatures » : constantes, statut global de suivi, validation des
   tâches, lecture sécurisée des paramètres de requête et des documents.
   Testés dans tests/candidateFollowUp.test.js. */

export const TASK_TYPES = ["call", "whatsapp", "email", "interview", "office_visit", "follow_up", "note", "other"];
export const TASK_STATUSES = ["pending", "in_progress", "completed"];
export const OPEN_TASK_STATUSES = ["pending", "in_progress"];
export const STUDENT_FILTERS = ["all", "new", "in_progress", "interview", "accepted", "rejected", "multiple", "with_tasks", "overdue"];
export const GLOBAL_STATUSES = ["new", "in_progress", "interview", "accepted", "rejected"];
export const STUDENT_SORTS = ["recent", "name", "applications"];
export const PAGE_SIZES = [10, 25, 50];
export const UPCOMING_INTERVIEW_STATUSES = ["proposé", "confirmé"];

export const MAX_TITLE_LENGTH = 160;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_SEARCH_LENGTH = 100;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MIN_DATE = Date.UTC(2000, 0, 1);
const FIVE_YEARS_MS = 5 * 365 * 24 * 3600 * 1000;

export function badRequest(message, code) {
  const err = new Error(message);
  err.statusCode = 400;
  if (code) err.code = code;
  return err;
}

export function isObjectIdString(value) {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

/* ── Statut global de suivi ────────────────────────────────────────────────
   Règles ordonnées (la première qui s'applique l'emporte). Une SEULE source
   pour le calcul JS et pour le $switch de l'agrégation MongoDB (filtres de
   la liste), afin que les deux ne puissent jamais diverger. */
export const GLOBAL_STATUS_RULES = [
  { status: "accepted",    test: "positive",          fields: ["acceptedCount"] },
  { status: "interview",   test: "positive",          fields: ["upcomingInterviews"] },
  { status: "rejected",    test: "allApplications",   fields: ["refusedCount"] },
  { status: "in_progress", test: "anyPositive",       fields: ["inReviewCount", "tasksTotal"] },
];
export const DEFAULT_GLOBAL_STATUS = "new";

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

export function computeGlobalStatus(counts = {}) {
  const value = (field) => numberOrZero(counts[field]);
  for (const rule of GLOBAL_STATUS_RULES) {
    if (rule.test === "positive" && value(rule.fields[0]) > 0) return rule.status;
    if (rule.test === "allApplications" && value("applicationsCount") > 0 && value(rule.fields[0]) === value("applicationsCount")) return rule.status;
    if (rule.test === "anyPositive" && rule.fields.some((field) => value(field) > 0)) return rule.status;
  }
  return DEFAULT_GLOBAL_STATUS;
}

// `fieldPaths` associe chaque compteur à son chemin dans l'agrégation
// (ex. { tasksTotal: "$taskStats.total" }).
export function buildGlobalStatusSwitch(fieldPaths) {
  const ref = (field) => ({ $ifNull: [fieldPaths[field], 0] });
  const branches = GLOBAL_STATUS_RULES.map((rule) => {
    let caseExpr;
    if (rule.test === "positive") caseExpr = { $gt: [ref(rule.fields[0]), 0] };
    else if (rule.test === "allApplications") {
      caseExpr = { $and: [{ $gt: [ref("applicationsCount"), 0] }, { $eq: [ref(rule.fields[0]), ref("applicationsCount")] }] };
    } else caseExpr = { $or: rule.fields.map((field) => ({ $gt: [ref(field), 0] })) };
    return { case: caseExpr, then: rule.status };
  });
  return { $switch: { branches, default: DEFAULT_GLOBAL_STATUS } };
}

/* ── Tâches ──────────────────────────────────────────────────────────────── */
function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function isTaskOverdue(task, now = new Date()) {
  if (!task || task.status === "completed") return false;
  const due = toTime(task.dueDate);
  return due !== null && due < new Date(now).getTime();
}

export function summarizeTasks(tasks = [], now = new Date()) {
  const nowTime = new Date(now).getTime();
  const summary = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, nextDueAt: null };
  let next = null;
  for (const task of tasks) {
    summary.total += 1;
    if (summary[task.status] !== undefined) summary[task.status] += 1;
    if (isTaskOverdue(task, now)) summary.overdue += 1;
    const due = toTime(task.dueDate);
    if (task.status !== "completed" && due !== null && due >= nowTime && (next === null || due < next)) next = due;
  }
  summary.nextDueAt = next === null ? null : new Date(next).toISOString();
  return summary;
}

function parseDateInRange(value, label, now) {
  if (typeof value !== "string" && !(value instanceof Date)) throw badRequest(`${label} invalide.`);
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) throw badRequest(`${label} invalide.`);
  if (time < MIN_DATE || time > new Date(now).getTime() + FIVE_YEARS_MS) throw badRequest(`${label} hors de la plage autorisée.`);
  return date;
}

/* Valide et normalise le corps d'une requête de création (partial=false) ou
   de modification (partial=true) de tâche. Liste blanche stricte : tout champ
   inconnu (studentId, createdBy, completedAt…) est ignoré. Renvoie
   { updates, confirmCompletion, expectedUpdatedAt, clientRequestId }. */
export function validateTaskInput(body, { partial = false, existing = null, now = new Date() } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Données de la tâche invalides.");
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
  const updates = {};

  if (has("type") || !partial) {
    if (typeof body.type !== "string" || !TASK_TYPES.includes(body.type)) throw badRequest("Type de tâche invalide.");
    updates.type = body.type;
  }

  if (has("title") || !partial) {
    if (typeof body.title !== "string") throw badRequest("Le titre de la tâche est requis.");
    const title = body.title.trim();
    if (!title) throw badRequest("Le titre de la tâche est requis.");
    if (title.length > MAX_TITLE_LENGTH) throw badRequest(`Le titre ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères.`);
    updates.title = title;
  }

  if (has("description")) {
    if (body.description === null) updates.description = "";
    else if (typeof body.description !== "string") throw badRequest("Description invalide.");
    else {
      const description = body.description.trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) throw badRequest(`La description ne doit pas dépasser ${MAX_DESCRIPTION_LENGTH} caractères.`);
      updates.description = description;
    }
  }

  if (has("activityDate")) {
    updates.activityDate = parseDateInRange(body.activityDate, "Date de l'action", now);
  } else if (!partial) {
    updates.activityDate = new Date(now);
  }

  if (has("dueDate")) {
    updates.dueDate = body.dueDate === null || body.dueDate === "" ? null : parseDateInRange(body.dueDate, "Échéance", now);
  }

  if (has("status")) {
    if (typeof body.status !== "string" || !TASK_STATUSES.includes(body.status)) throw badRequest("Statut de tâche invalide.");
    updates.status = body.status;
  }

  if (has("applicationId")) {
    if (body.applicationId === null || body.applicationId === "") updates.applicationId = null;
    else if (!isObjectIdString(body.applicationId)) throw badRequest("Candidature invalide.");
    else updates.applicationId = body.applicationId;
  }

  let expectedUpdatedAt = null;
  if (partial && has("expectedUpdatedAt") && body.expectedUpdatedAt !== null) {
    const time = toTime(typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : null);
    if (time === null) throw badRequest("Version de la tâche invalide.");
    expectedUpdatedAt = new Date(time);
  }

  let clientRequestId = null;
  if (!partial && has("clientRequestId") && body.clientRequestId !== null) {
    if (typeof body.clientRequestId !== "string" || !CLIENT_REQUEST_ID_PATTERN.test(body.clientRequestId)) {
      throw badRequest("Identifiant de requête invalide.");
    }
    clientRequestId = body.clientRequestId;
  }

  const confirmCompletion = body.confirmCompletion === true;
  const finalType = updates.type ?? existing?.type;

  // Une note interne est un simple enregistrement : toujours « terminée ».
  if (finalType === "note") updates.status = "completed";

  // Une note transformée en appel / WhatsApp / email… n'a jamais été
  // « réalisée » : elle repart à « à faire » sauf confirmation explicite.
  const leavingNote = existing?.type === "note" && finalType !== "note";
  if (leavingNote && !updates.status) updates.status = "pending";

  const previousStatus = existing?.status ?? null;
  const finalStatus = updates.status ?? previousStatus ?? "pending";
  if (!partial && !updates.status) updates.status = "pending";

  // Un appel, un message WhatsApp, un email… ne passe JAMAIS à « terminée »
  // sans confirmation explicite de l'administrateur.
  const becomesCompleted = finalStatus === "completed" && (previousStatus !== "completed" || leavingNote);
  if (becomesCompleted && finalType !== "note" && !confirmCompletion) {
    throw badRequest(
      "Confirmez explicitement que l'action a bien été réalisée avant de la marquer comme terminée.",
      "COMPLETION_CONFIRMATION_REQUIRED",
    );
  }

  return { updates, confirmCompletion, expectedUpdatedAt, clientRequestId };
}

/* ── Paramètres de requête (req.query n'est PAS nettoyé par mongoSanitize) ── */
function queryString(value) {
  return typeof value === "string" ? value : "";
}

function parsePositiveInt(value, fallback, max) {
  const text = queryString(value).trim();
  if (!/^\d{1,6}$/.test(text)) return fallback;
  const number = Number(text);
  return number >= 1 && number <= max ? number : fallback;
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseListQuery(query = {}) {
  const search = queryString(query.search).trim().slice(0, MAX_SEARCH_LENGTH);
  const filter = STUDENT_FILTERS.includes(queryString(query.filter)) ? queryString(query.filter) : "all";
  const sort = STUDENT_SORTS.includes(queryString(query.sort)) ? queryString(query.sort) : "recent";
  const limitValue = parsePositiveInt(query.limit, 10, 1000);
  const limit = PAGE_SIZES.includes(limitValue) ? limitValue : 10;
  const page = parsePositiveInt(query.page, 1, 100000);
  return { search, filter, sort, page, limit };
}

export function parseTaskQuery(query = {}) {
  const status = queryString(query.status);
  const type = queryString(query.type);
  const applicationId = queryString(query.applicationId);
  return {
    status: TASK_STATUSES.includes(status) ? status : null,
    type: TASK_TYPES.includes(type) ? type : null,
    applicationId: applicationId === "none" ? "none" : isObjectIdString(applicationId) ? applicationId : null,
    overdue: queryString(query.overdue) === "true",
  };
}

/* ── Documents (CV / lettres) ─────────────────────────────────────────────── */
export const DOCUMENT_CONTENT_TYPES = {
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function parseDocumentKey(key) {
  if (typeof key !== "string") return null;
  if (key === "profile-cv") return { kind: "cv", source: "profile", applicationId: null };
  const match = /^(application-cv|cover-letter):([a-f\d]{24})$/i.exec(key);
  if (!match) return null;
  return {
    kind: match[1] === "cover-letter" ? "coverLetter" : "cv",
    source: "application",
    applicationId: match[2],
  };
}

/* Transforme une URL stockée (absolue « http(s)://hôte/uploads/x.pdf » ou
   relative « /uploads/x.pdf ») en fichier local du dossier uploads — SEULEMENT
   si le nom est sûr (pas de « .. », pas de sous-dossier, extension autorisée,
   préfixe « cv- » des fichiers déposés par l'upload CV/lettre). */
export function resolveLocalUpload(url, uploadsDir) {
  if (typeof url !== "string" || !url.trim() || !uploadsDir) return null;
  let pathname;
  try {
    pathname = new URL(url.trim(), "http://local.invalid").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith("/uploads/")) return null;
  const name = pathname.slice("/uploads/".length);
  if (!/^cv-[A-Za-z0-9._-]{1,196}$/.test(name) || name.includes("..")) return null;
  const extension = path.extname(name).toLowerCase();
  const contentType = DOCUMENT_CONTENT_TYPES[extension];
  if (!contentType) return null;
  const base = path.resolve(uploadsDir);
  const filePath = path.resolve(base, name);
  if (path.dirname(filePath) !== base) return null;
  return { name, filePath, extension: extension.slice(1), contentType };
}

export function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function fileExtension(value) {
  if (typeof value !== "string") return "";
  let pathname = value;
  try { pathname = new URL(value, "http://local.invalid").pathname; } catch { /* nom de fichier simple */ }
  const extension = path.extname(pathname).toLowerCase();
  return DOCUMENT_CONTENT_TYPES[extension] ? extension.slice(1) : "";
}

export function ensureExtension(fileName, extension) {
  const name = String(fileName || "").trim() || "document";
  if (!extension) return name;
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}

// En-tête Content-Disposition sûr : guillemets / retours ligne retirés de la
// version ASCII, nom UTF-8 complet en RFC 5987 (filename*).
export function buildContentDisposition(disposition, fileName) {
  const type = disposition === "attachment" ? "attachment" : "inline";
  const raw = String(fileName || "document").replace(/[\r\n\t"\\/]/g, " ").replace(/\s+/g, " ").trim() || "document";
  const ascii = raw.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/[;%]/g, "_").trim() || "document";
  const encoded = encodeURIComponent(raw).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function truncateText(text, max = 600) {
  const value = typeof text === "string" ? text.trim() : "";
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
