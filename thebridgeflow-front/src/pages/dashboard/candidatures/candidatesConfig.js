import {
  Phone, MessageCircle, Mail, CalendarClock, Building2, BellRing, StickyNote,
  Sparkles, CircleDashed, Loader, CircleCheck, CircleAlert, Inbox, UserCheck,
  UserX, CalendarDays, Activity, Layers, AlarmClock, Users,
} from "lucide-react";

// Taille / épaisseur uniformes pour toutes les icônes de l'espace Candidatures.
export const ICON_SIZE = 16;
export const ICON_SIZE_LG = 18;
export const ICON_STROKE = 1.9;

/* ── Types de tâches de suivi ──────────────────────────────────────────────
   `key` = valeur stockée en base (cf. FollowUpTask.type côté backend).
   `tone` pilote la couleur (classes .cnd-tone--<tone>).
   `needsDueDate` : l'échéance est proposée d'emblée dans le formulaire.
   `contact` : action de contact direct (téléphone / WhatsApp / email) — ne
   doit JAMAIS être enregistrée comme terminée sans confirmation explicite. */
export const TASK_TYPES = [
  { key: "call",         Icon: Phone,          tone: "blue",    needsDueDate: false, contact: "phone" },
  { key: "whatsapp",     Icon: MessageCircle,  tone: "emerald", needsDueDate: false, contact: "whatsapp" },
  { key: "email",        Icon: Mail,           tone: "indigo",  needsDueDate: false, contact: "email" },
  { key: "interview",    Icon: CalendarClock,  tone: "violet",  needsDueDate: true },
  { key: "office_visit", Icon: Building2,      tone: "cyan",    needsDueDate: true },
  { key: "follow_up",    Icon: BellRing,       tone: "amber",   needsDueDate: true },
  { key: "note",         Icon: StickyNote,     tone: "slate",   needsDueDate: false, isNote: true },
  { key: "other",        Icon: Sparkles,       tone: "rose",    needsDueDate: false },
];

export const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.map((type) => [type.key, type]));

export function getTaskType(key) {
  return TASK_TYPE_MAP[key] || TASK_TYPE_MAP.other;
}

/* ── Statuts de tâche ─────────────────────────────────────────────────────── */
export const TASK_STATUSES = [
  { key: "pending",     Icon: CircleDashed, tone: "slate" },
  { key: "in_progress", Icon: Loader,       tone: "amber" },
  { key: "completed",   Icon: CircleCheck,  tone: "emerald" },
];

export const TASK_STATUS_MAP = Object.fromEntries(TASK_STATUSES.map((status) => [status.key, status]));

// Pseudo-statut d'affichage (calculé, jamais stocké).
export const OVERDUE_META = { key: "overdue", Icon: CircleAlert, tone: "red" };

/* ── Statut global de suivi d'un étudiant (calculé côté backend) ──────────── */
export const GLOBAL_STATUSES = [
  { key: "new",         Icon: Inbox,        tone: "blue" },
  { key: "in_progress", Icon: Activity,     tone: "amber" },
  { key: "interview",   Icon: CalendarDays, tone: "violet" },
  { key: "accepted",    Icon: UserCheck,    tone: "emerald" },
  { key: "rejected",    Icon: UserX,        tone: "rose" },
];

export const GLOBAL_STATUS_MAP = Object.fromEntries(GLOBAL_STATUSES.map((status) => [status.key, status]));

/* ── Filtres de la vue « Par étudiant » (valeurs envoyées au backend) ─────── */
export const STUDENT_FILTERS = [
  { key: "all",         Icon: Users },
  { key: "new",         Icon: Inbox },
  { key: "in_progress", Icon: Activity },
  { key: "interview",   Icon: CalendarDays },
  { key: "accepted",    Icon: UserCheck },
  { key: "rejected",    Icon: UserX },
  { key: "multiple",    Icon: Layers },
  { key: "overdue",     Icon: AlarmClock },
];

export const STUDENT_SORTS = ["recent", "name", "applications"];
export const STUDENT_PAGE_SIZES = [10, 25, 50];

/* ── Statuts de candidature existants (Application.status) ────────────────── */
export const APPLICATION_STATUS_TONE = {
  "en attente": "amber",
  "en cours":   "blue",
  "acceptée":   "emerald",
  "refusée":    "rose",
};

/* ── Statuts d'entretien existants (Interview.status) ─────────────────────── */
export const INTERVIEW_STATUS_TONE = {
  "proposé":  "violet",
  "confirmé": "emerald",
  "annulé":   "rose",
  "terminé":  "slate",
};

export function toneClass(tone) {
  return `cnd-tone--${tone || "slate"}`;
}
