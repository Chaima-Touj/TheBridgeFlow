import test from "node:test";
import assert from "node:assert/strict";
import {
  filterTasks, filterSystemEvents, hasActiveFilters, upcomingTasks, isDueSoon, relativeDayKind,
  upsertTask, removeTask, initialTaskForm, validateTaskForm, buildTaskPayload, buildTaskPatch,
  needsCompletionConfirmation, DEFAULT_TIMELINE_FILTERS,
} from "./dossierUtils.js";

const NOW = new Date(2026, 10, 16, 12, 0).getTime();
const day = 24 * 3600 * 1000;
const tasks = [
  { _id: "1", type: "call", status: "pending", dueDate: new Date(NOW - day).toISOString(), applicationId: "a1", activityDate: new Date(NOW - 2 * day).toISOString(), createdAt: "2026-11-10" },
  { _id: "2", type: "email", status: "completed", dueDate: null, applicationId: null, activityDate: new Date(NOW - day).toISOString(), createdAt: "2026-11-11" },
  { _id: "3", type: "call", status: "in_progress", dueDate: new Date(NOW + day).toISOString(), applicationId: "a2", activityDate: new Date(NOW).toISOString(), createdAt: "2026-11-12" },
];
const f = (patch) => ({ ...DEFAULT_TIMELINE_FILTERS, ...patch });

test("filterTasks by type, status, overdue and application", () => {
  assert.deepEqual(filterTasks(tasks, f({}), NOW).map((t) => t._id), ["1", "2", "3"]);
  assert.deepEqual(filterTasks(tasks, f({ type: "call" }), NOW).map((t) => t._id), ["1", "3"]);
  assert.deepEqual(filterTasks(tasks, f({ status: "overdue" }), NOW).map((t) => t._id), ["1"]);
  assert.deepEqual(filterTasks(tasks, f({ status: "completed" }), NOW).map((t) => t._id), ["2"]);
  assert.deepEqual(filterTasks(tasks, f({ applicationId: "none" }), NOW).map((t) => t._id), ["2"]);
  assert.deepEqual(filterTasks(tasks, f({ applicationId: "a2" }), NOW).map((t) => t._id), ["3"]);
});

test("system events follow the filters", () => {
  const events = [{ id: "e1", applicationId: "a1" }, { id: "e2", applicationId: "a2" }];
  assert.equal(filterSystemEvents(events, f({})).length, 2);
  assert.equal(filterSystemEvents(events, f({ showSystem: false })).length, 0);
  assert.equal(filterSystemEvents(events, f({ type: "call" })).length, 0);
  assert.deepEqual(filterSystemEvents(events, f({ applicationId: "a2" })).map((e) => e.id), ["e2"]);
  assert.equal(filterSystemEvents(events, f({ applicationId: "none" })).length, 0);
  assert.equal(hasActiveFilters(f({})), false);
  assert.equal(hasActiveFilters(f({ status: "completed" })), true);
});

test("upcoming tasks: overdue first then by due date", () => {
  assert.deepEqual(upcomingTasks(tasks, NOW).map((t) => t._id), ["1", "3"]);
  assert.equal(isDueSoon(tasks[2], NOW), true);
  assert.equal(isDueSoon(tasks[0], NOW), false);
});

test("relativeDayKind", () => {
  assert.equal(relativeDayKind(NOW, NOW), "today");
  assert.equal(relativeDayKind(NOW - day, NOW), "yesterday");
  assert.equal(relativeDayKind(NOW + day, NOW), "tomorrow");
  assert.equal(relativeDayKind(NOW - 5 * day, NOW), null);
});

test("upsert and remove keep chronological order", () => {
  const added = upsertTask(tasks, { _id: "4", activityDate: new Date(NOW + 1000).toISOString(), createdAt: "2026-11-16" });
  assert.equal(added[0]._id, "4");
  assert.equal(added.length, 4);
  const replaced = upsertTask(tasks, { ...tasks[1], title: "x" });
  assert.equal(replaced.length, 3);
  assert.deepEqual(removeTask(tasks, "2").map((t) => t._id), ["1", "3"]);
});

test("task form validation and completion confirmation", () => {
  const form = { ...initialTaskForm({ now: NOW }), type: "whatsapp", status: "completed" };
  assert.equal(needsCompletionConfirmation(form), true);
  assert.equal(validateTaskForm(form, { title: "Relance" }).confirmDone, "confirmRequired");
  assert.equal(validateTaskForm({ ...form, confirmDone: true }, { title: "Relance" }).confirmDone, undefined);
  assert.equal(validateTaskForm({ ...form, type: "note" }, { title: "Note" }).confirmDone, undefined);
  assert.equal(validateTaskForm(form, { title: " " }).title, "titleRequired");
  assert.equal(validateTaskForm(form, { title: "x".repeat(161) }).title, "titleTooLong");
  assert.equal(validateTaskForm({ ...form, type: "" }, { title: "x" }).type, "typeRequired");
  assert.equal(validateTaskForm({ ...form, activityDate: "" }, { title: "x" }).activityDate, "dateInvalid");
  assert.equal(validateTaskForm({ ...form, activityDate: "1990-01-01T10:00" }, { title: "x", now: NOW }).activityDate, "dateOutOfRange");
  assert.equal(validateTaskForm({ ...form, dueEnabled: true, dueDate: "2099-01-01T10:00" }, { title: "x", now: NOW }).dueDate, "dateOutOfRange");
});

test("a note converted to a contact type requires confirmation to stay completed", () => {
  const note = { _id: "n", type: "note", title: "Note", description: "", status: "completed", applicationId: null, activityDate: new Date(NOW).toISOString(), dueDate: null };
  const form = { ...initialTaskForm({ task: note }), type: "call" };
  assert.equal(needsCompletionConfirmation(form, note), true);
  assert.deepEqual(buildTaskPatch({ ...form, status: "pending" }, note, { title: "Note" }), { type: "call", status: "pending" });
  assert.deepEqual(buildTaskPatch({ ...form, confirmDone: true }, note, { title: "Note" }), { type: "call", status: "completed", confirmCompletion: true });
});

test("buildTaskPayload never completes without confirmation flag", () => {
  const form = { ...initialTaskForm({ now: NOW }), type: "call", status: "completed", confirmDone: true };
  const payload = buildTaskPayload(form, { title: " Appel ", clientRequestId: "abc-12345678" });
  assert.equal(payload.title, "Appel");
  assert.equal(payload.status, "completed");
  assert.equal(payload.confirmCompletion, true);
  assert.equal(payload.dueDate, null);
  assert.equal(payload.clientRequestId, "abc-12345678");
  const note = buildTaskPayload({ ...form, type: "note" }, { title: "Note" });
  assert.equal(note.status, undefined);
  assert.equal(note.confirmCompletion, undefined);
});

test("buildTaskPatch only sends changed fields", () => {
  const original = {
    _id: "1", type: "call", title: "Appel", description: "", status: "pending", applicationId: "a1",
    activityDate: new Date(2026, 10, 16, 9, 5, 42).toISOString(), dueDate: null, updatedAt: "2026-11-16T09:05:42.000Z",
  };
  const form = initialTaskForm({ task: original });
  assert.deepEqual(buildTaskPatch(form, original, { title: "Appel" }), {});
  assert.deepEqual(buildTaskPatch({ ...form, status: "in_progress" }, original, { title: "Appel" }), { status: "in_progress" });
  assert.deepEqual(buildTaskPatch({ ...form, status: "completed", confirmDone: true }, original, { title: "Appel" }), { status: "completed", confirmCompletion: true });
  assert.deepEqual(buildTaskPatch({ ...form, applicationId: "" }, original, { title: "Appel 2" }), { title: "Appel 2", applicationId: null });
});
