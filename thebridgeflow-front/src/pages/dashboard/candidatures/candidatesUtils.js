/* Fonctions pures de l'espace Candidatures (aucune dépendance navigateur au
   chargement du module : testées avec `node --test`). */

const LOCALE_MAP = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" };

export function resolveLocale(language) {
  const base = String(language || "fr").slice(0, 2).toLowerCase();
  return LOCALE_MAP[base] || LOCALE_MAP.fr;
}

function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, locale = "fr-FR", options = { day: "2-digit", month: "short", year: "numeric" }) {
  const date = toDate(value);
  return date ? date.toLocaleDateString(locale, options) : "";
}

export function formatDateTime(value, locale = "fr-FR") {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(value, locale = "fr-FR") {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
}

const RELATIVE_STEPS = [
  { unit: "year",   seconds: 365 * 24 * 3600 },
  { unit: "month",  seconds: 30 * 24 * 3600 },
  { unit: "week",   seconds: 7 * 24 * 3600 },
  { unit: "day",    seconds: 24 * 3600 },
  { unit: "hour",   seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

// « il y a 3 jours », « dans 2 heures »… — `now` injectable pour les tests.
export function formatRelative(value, locale = "fr-FR", now = Date.now()) {
  const date = toDate(value);
  if (!date) return "";
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const step of RELATIVE_STEPS) {
    if (abs >= step.seconds) return formatter.format(Math.trunc(diffSeconds / step.seconds), step.unit);
  }
  return formatter.format(0, "minute");
}

export function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return `${first}${last}`.toUpperCase();
}

const AVATAR_TONES = ["blue", "violet", "emerald", "amber", "rose", "cyan", "indigo"];

export function avatarTone(seed = "") {
  let hash = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

const pad = (n) => String(n).padStart(2, "0");

// Valeur pour <input type="datetime-local"> (heure locale, sans secondes).
export function toDateTimeLocalValue(value) {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Inverse : "YYYY-MM-DDTHH:mm" (heure locale) → ISO UTC, ou null si vide/invalide.
export function fromDateTimeLocalValue(value) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isTaskOverdue(task, now = Date.now()) {
  if (!task || task.status === "completed") return false;
  const due = toDate(task.dueDate);
  return Boolean(due && due.getTime() < now);
}

// Statut d'affichage : « overdue » prime sur pending / in_progress.
export function taskDisplayStatus(task, now = Date.now()) {
  if (!task) return "pending";
  return isTaskOverdue(task, now) ? "overdue" : task.status || "pending";
}

export function summarizeTasks(tasks = [], now = Date.now()) {
  const summary = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0, nextDueAt: null };
  for (const task of tasks) {
    summary.total += 1;
    if (summary[task.status] !== undefined) summary[task.status] += 1;
    if (isTaskOverdue(task, now)) summary.overdue += 1;
    const due = toDate(task.dueDate);
    if (task.status !== "completed" && due && due.getTime() >= now) {
      if (!summary.nextDueAt || due.getTime() < new Date(summary.nextDueAt).getTime()) summary.nextDueAt = due.toISOString();
    }
  }
  return summary;
}

/* ── Liens de contact ─────────────────────────────────────────────────────── */
function phoneDigits(phone) {
  if (typeof phone !== "string") return "";
  const trimmed = phone.trim();
  let digits = trimmed.replace(/[^\d]/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  return digits;
}

export function buildTelLink(phone) {
  const digits = phoneDigits(phone);
  if (digits.length < 8 || digits.length > 15) return "";
  const international = digits.length === 8 ? `216${digits}` : digits;
  return `tel:+${international}`;
}

// Numéro tunisien à 8 chiffres → indicatif 216 ajouté (format wa.me).
export function buildWhatsAppLink(phone, message = "") {
  const digits = phoneDigits(phone);
  if (digits.length < 8 || digits.length > 15) return "";
  const international = digits.length === 8 ? `216${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${international}${text}`;
}

const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

export function buildMailtoLink(email, subject = "") {
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) return "";
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${email.trim()}${query}`;
}

export function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

/* ── Idempotence (protection contre les doubles soumissions) ─────────────── */
export function createClientRequestId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const random = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  return `${random()}-${random()}-${random()}-${random()}`;
}

/* ── Erreurs API ──────────────────────────────────────────────────────────── */
export function getApiErrorCode(error) {
  return error?.response?.data?.code || "";
}

export function getApiErrorMessage(error, fallback = "") {
  if (!error?.response) return fallback;
  return error.response.data?.message || fallback;
}

export function isNetworkError(error) {
  return Boolean(error) && !error.response && error.code !== "ERR_CANCELED" && error.name !== "CanceledError";
}

export function isCanceledError(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError" || error?.name === "AbortError";
}

// Une requête axios `responseType: "blob"` renvoie aussi l'erreur JSON du
// backend sous forme de Blob : on la relit pour récupérer { message, code }.
export async function readBlobError(error) {
  const data = error?.response?.data;
  if (data && typeof data.text === "function") {
    try {
      const parsed = JSON.parse(await data.text());
      return { message: parsed?.message || "", code: parsed?.code || "" };
    } catch {
      return { message: "", code: "" };
    }
  }
  return { message: data?.message || "", code: data?.code || "" };
}

/* ── Timeline : fusion tâches + événements système ───────────────────────── */
function timeOf(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

// Renvoie [{ kind: "task" | "system", id, date, task?, event? }] trié par date.
export function mergeTimeline(tasks = [], systemEvents = [], order = "desc") {
  const items = [
    ...tasks.map((task) => ({ kind: "task", id: `task:${task._id}`, date: task.activityDate || task.createdAt, task })),
    ...systemEvents.map((event) => ({ kind: "system", id: `system:${event.id}`, date: event.date, event })),
  ];
  const direction = order === "asc" ? 1 : -1;
  return items.sort((a, b) => {
    const diff = timeOf(a.date) - timeOf(b.date);
    if (diff !== 0) return diff * direction;
    // À date égale : tâches créées en dernier d'abord (desc) / ensuite (asc).
    const created = timeOf(a.task?.createdAt) - timeOf(b.task?.createdAt);
    return created * direction;
  });
}

function dayKeyOf(value) {
  const date = toDate(value);
  if (!date) return "unknown";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Regroupe des éléments déjà triés par jour local, en conservant l'ordre.
export function groupTimelineByDay(items = []) {
  const groups = [];
  const byKey = new Map();
  for (const item of items) {
    const key = dayKeyOf(item.date);
    let group = byKey.get(key);
    if (!group) {
      group = { key, date: item.date, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
