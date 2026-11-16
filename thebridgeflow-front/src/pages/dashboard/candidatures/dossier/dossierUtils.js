/* Fonctions pures du dossier étudiant (filtres de la timeline, échéances,
   validation et diff du formulaire de tâche). Testées avec node --test. */
import { fromDateTimeLocalValue, isTaskOverdue, toDateTimeLocalValue } from "../candidatesUtils.js";

export const TIMELINE_STATUS_FILTERS = ["all", "pending", "in_progress", "completed", "overdue"];
export const DEFAULT_TIMELINE_FILTERS = { type: "all", status: "all", applicationId: "all", order: "desc", showSystem: true };
export const MAX_TITLE = 160;
export const MAX_DESCRIPTION = 5000;

function taskApplicationId(task) {
  return task?.applicationId ? String(task.applicationId) : null;
}

export function filterTasks(tasks = [], filters = DEFAULT_TIMELINE_FILTERS, now = Date.now()) {
  return tasks.filter((task) => {
    if (filters.type !== "all" && task.type !== filters.type) return false;
    if (filters.status === "overdue" && !isTaskOverdue(task, now)) return false;
    if (filters.status !== "all" && filters.status !== "overdue" && task.status !== filters.status) return false;
    if (filters.applicationId === "none" && taskApplicationId(task)) return false;
    if (filters.applicationId !== "all" && filters.applicationId !== "none" && taskApplicationId(task) !== filters.applicationId) return false;
    return true;
  });
}

// Les événements système (candidature reçue, entretien…) n'ont ni type ni
// statut de tâche : ils ne s'affichent que sans filtre de type/statut.
export function filterSystemEvents(events = [], filters = DEFAULT_TIMELINE_FILTERS) {
  if (!filters.showSystem || filters.type !== "all" || filters.status !== "all") return [];
  if (filters.applicationId === "none") return [];
  if (filters.applicationId === "all") return events;
  return events.filter((event) => String(event.applicationId) === filters.applicationId);
}

export function hasActiveFilters(filters = DEFAULT_TIMELINE_FILTERS) {
  return filters.type !== "all" || filters.status !== "all" || filters.applicationId !== "all" || !filters.showSystem;
}

// Prochaines échéances : tâches ouvertes datées, en retard d'abord.
export function upcomingTasks(tasks = [], now = Date.now(), max = 5) {
  return tasks
    .filter((task) => task.status !== "completed" && task.dueDate && !Number.isNaN(new Date(task.dueDate).getTime()))
    .sort((a, b) => {
      const overdueDiff = Number(isTaskOverdue(b, now)) - Number(isTaskOverdue(a, now));
      if (overdueDiff) return overdueDiff;
      return new Date(a.dueDate) - new Date(b.dueDate);
    })
    .slice(0, max);
}

export function isDueSoon(task, now = Date.now(), hours = 48) {
  if (!task?.dueDate || task.status === "completed") return false;
  const due = new Date(task.dueDate).getTime();
  return due >= now && due - now <= hours * 3600 * 1000;
}

function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// "today" | "yesterday" | "tomorrow" | null (jour local).
export function relativeDayKind(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const diffDays = Math.round((startOfDay(time) - startOfDay(now)) / (24 * 3600 * 1000));
  if (diffDays === 0) return "today";
  if (diffDays === -1) return "yesterday";
  if (diffDays === 1) return "tomorrow";
  return null;
}

export function upsertTask(tasks = [], task) {
  const index = tasks.findIndex((item) => item._id === task._id);
  const next = index === -1 ? [task, ...tasks] : tasks.map((item) => (item._id === task._id ? task : item));
  return next.sort((a, b) => {
    const diff = new Date(b.activityDate) - new Date(a.activityDate);
    return diff || new Date(b.createdAt) - new Date(a.createdAt);
  });
}

export function removeTask(tasks = [], taskId) {
  return tasks.filter((task) => task._id !== taskId);
}

/* ── Formulaire de tâche ──────────────────────────────────────────────────── */
export function initialTaskForm({ task = null, preset = {}, now = Date.now() } = {}) {
  if (task) {
    return {
      type: task.type,
      title: task.title || "",
      titleTouched: true,
      activityDate: toDateTimeLocalValue(task.activityDate),
      dueEnabled: Boolean(task.dueDate),
      dueDate: toDateTimeLocalValue(task.dueDate),
      applicationId: task.applicationId ? String(task.applicationId) : "",
      status: task.status,
      description: task.description || "",
      confirmDone: false,
    };
  }
  return {
    type: preset.type || "",
    title: "",
    titleTouched: false,
    activityDate: toDateTimeLocalValue(now),
    dueEnabled: false,
    dueDate: "",
    applicationId: preset.applicationId ? String(preset.applicationId) : "",
    status: preset.status || "pending",
    description: "",
    confirmDone: false,
  };
}

// La confirmation explicite n'est exigée que lors du PASSAGE à « terminée ».
export function needsCompletionConfirmation(form, originalTask = null) {
  if (form.type === "note") return false;
  if (form.status !== "completed") return false;
  return !originalTask || originalTask.status !== "completed";
}

// Renvoie { field: messageKey } — vide si le formulaire est valide.
export function validateTaskForm(form, { title, originalTask = null } = {}) {
  const errors = {};
  if (!form.type) errors.type = "typeRequired";
  const finalTitle = (title ?? form.title ?? "").trim();
  if (!finalTitle) errors.title = "titleRequired";
  else if (finalTitle.length > MAX_TITLE) errors.title = "titleTooLong";
  if ((form.description || "").length > MAX_DESCRIPTION) errors.description = "descriptionTooLong";
  if (!fromDateTimeLocalValue(form.activityDate)) errors.activityDate = "dateInvalid";
  if (form.dueEnabled && form.dueDate && !fromDateTimeLocalValue(form.dueDate)) errors.dueDate = "dateInvalid";
  if (needsCompletionConfirmation(form, originalTask) && !form.confirmDone) errors.confirmDone = "confirmRequired";
  return errors;
}

export function buildTaskPayload(form, { title, clientRequestId }) {
  const payload = {
    type: form.type,
    title: title.trim(),
    description: form.description.trim(),
    activityDate: fromDateTimeLocalValue(form.activityDate),
    dueDate: form.dueEnabled ? fromDateTimeLocalValue(form.dueDate) : null,
    applicationId: form.applicationId || null,
  };
  if (form.type !== "note") payload.status = form.status;
  if (needsCompletionConfirmation(form)) payload.confirmCompletion = form.confirmDone === true;
  if (clientRequestId) payload.clientRequestId = clientRequestId;
  return payload;
}

function sameInstant(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

// Modification : seuls les champs réellement changés + la version attendue.
export function buildTaskPatch(form, originalTask, { title }) {
  const full = buildTaskPayload(form, { title });
  const patch = {};
  if (full.type !== originalTask.type) patch.type = full.type;
  if (full.title !== originalTask.title) patch.title = full.title;
  if (full.description !== (originalTask.description || "")) patch.description = full.description;
  if (!sameInstant(full.activityDate, originalTask.activityDate)) {
    // Le champ datetime-local est à la minute : on ignore les secondes d'origine.
    const originalMinute = fromDateTimeLocalValue(toDateTimeLocalValue(originalTask.activityDate));
    if (!sameInstant(full.activityDate, originalMinute)) patch.activityDate = full.activityDate;
  }
  if (!sameInstant(full.dueDate, originalTask.dueDate)) {
    const originalMinute = originalTask.dueDate ? fromDateTimeLocalValue(toDateTimeLocalValue(originalTask.dueDate)) : null;
    if (!sameInstant(full.dueDate, originalMinute)) patch.dueDate = full.dueDate;
  }
  if ((full.applicationId || null) !== (originalTask.applicationId ? String(originalTask.applicationId) : null)) patch.applicationId = full.applicationId;
  if (full.status && full.status !== originalTask.status) patch.status = full.status;
  if (needsCompletionConfirmation(form, originalTask)) patch.confirmCompletion = form.confirmDone === true;
  return patch;
}
