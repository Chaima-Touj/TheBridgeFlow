import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLocale, getInitials, avatarTone, toDateTimeLocalValue, fromDateTimeLocalValue,
  isTaskOverdue, taskDisplayStatus, summarizeTasks, buildTelLink, buildWhatsAppLink,
  buildMailtoLink, safeExternalUrl, createClientRequestId, mergeTimeline, groupTimelineByDay,
  formatRelative, getApiErrorMessage, isNetworkError, readBlobError,
} from "./candidatesUtils.js";

const NOW = new Date("2026-11-16T12:00:00Z").getTime();

test("resolveLocale maps app languages to Intl locales", () => {
  assert.equal(resolveLocale("fr"), "fr-FR");
  assert.equal(resolveLocale("en-US"), "en-GB");
  assert.equal(resolveLocale("ar"), "ar-TN");
  assert.equal(resolveLocale(undefined), "fr-FR");
});

test("getInitials keeps first and last name initials", () => {
  assert.equal(getInitials("Ahmed Abid"), "AA");
  assert.equal(getInitials("  sarra  ben haddad "), "SH");
  assert.equal(getInitials("Ayoub"), "A");
  assert.equal(getInitials(""), "");
});

test("avatarTone is deterministic", () => {
  assert.equal(avatarTone("Ahmed Abid"), avatarTone("Ahmed Abid"));
});

test("datetime-local conversion round-trips", () => {
  const local = toDateTimeLocalValue(new Date(2026, 10, 16, 9, 5));
  assert.equal(local, "2026-11-16T09:05");
  assert.equal(new Date(fromDateTimeLocalValue(local)).getTime(), new Date(2026, 10, 16, 9, 5).getTime());
  assert.equal(fromDateTimeLocalValue(""), null);
  assert.equal(fromDateTimeLocalValue("not-a-date"), null);
  assert.equal(toDateTimeLocalValue(null), "");
});

test("overdue only for open tasks with a past due date", () => {
  assert.equal(isTaskOverdue({ status: "pending", dueDate: "2026-11-15T00:00:00Z" }, NOW), true);
  assert.equal(isTaskOverdue({ status: "in_progress", dueDate: "2026-11-15T00:00:00Z" }, NOW), true);
  assert.equal(isTaskOverdue({ status: "completed", dueDate: "2026-11-15T00:00:00Z" }, NOW), false);
  assert.equal(isTaskOverdue({ status: "pending", dueDate: "2026-11-17T00:00:00Z" }, NOW), false);
  assert.equal(isTaskOverdue({ status: "pending", dueDate: null }, NOW), false);
  assert.equal(taskDisplayStatus({ status: "pending", dueDate: "2026-11-01" }, NOW), "overdue");
  assert.equal(taskDisplayStatus({ status: "completed" }, NOW), "completed");
});

test("summarizeTasks counts statuses, overdue and next due date", () => {
  const summary = summarizeTasks([
    { status: "pending", dueDate: "2026-11-10T00:00:00Z" },
    { status: "pending", dueDate: "2026-11-20T00:00:00Z" },
    { status: "in_progress", dueDate: "2026-11-18T00:00:00Z" },
    { status: "completed", dueDate: "2026-11-01T00:00:00Z" },
  ], NOW);
  assert.deepEqual(summary, {
    total: 4, pending: 2, in_progress: 1, completed: 1, overdue: 1, nextDueAt: "2026-11-18T00:00:00.000Z",
  });
});

test("contact links are built safely", () => {
  assert.equal(buildTelLink("+216 20 123 456"), "tel:+21620123456");
  assert.equal(buildTelLink("20123456"), "tel:+21620123456");
  assert.equal(buildTelLink("abc"), "");
  assert.equal(buildWhatsAppLink("20 123 456"), "https://wa.me/21620123456");
  assert.equal(buildWhatsAppLink("0033612345678", "Bonjour"), "https://wa.me/33612345678?text=Bonjour");
  assert.equal(buildWhatsAppLink(""), "");
  assert.equal(buildMailtoLink("a@b.tn", "Suivi"), "mailto:a@b.tn?subject=Suivi");
  assert.equal(buildMailtoLink("javascript:alert(1)"), "");
});

test("safeExternalUrl only accepts http(s) without credentials", () => {
  assert.equal(safeExternalUrl("https://linkedin.com/in/x"), "https://linkedin.com/in/x");
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("https://user:pass@evil.tn"), "");
  assert.equal(safeExternalUrl(""), "");
});

test("createClientRequestId returns unique ids", () => {
  const a = createClientRequestId();
  const b = createClientRequestId();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9-]{8,64}$/);
});

test("mergeTimeline orders tasks and system events by date", () => {
  const tasks = [
    { _id: "t1", activityDate: "2026-11-14T10:00:00Z", createdAt: "2026-11-14T10:00:00Z" },
    { _id: "t2", activityDate: "2026-11-15T10:00:00Z", createdAt: "2026-11-15T10:00:00Z" },
  ];
  const events = [{ id: "application_received:a1", date: "2026-11-12T08:00:00Z" }];
  const desc = mergeTimeline(tasks, events);
  assert.deepEqual(desc.map((item) => item.id), ["task:t2", "task:t1", "system:application_received:a1"]);
  const asc = mergeTimeline(tasks, events, "asc");
  assert.deepEqual(asc.map((item) => item.id), ["system:application_received:a1", "task:t1", "task:t2"]);
});

test("groupTimelineByDay keeps order and groups by local day", () => {
  const groups = groupTimelineByDay([
    { id: "a", date: new Date(2026, 10, 15, 18) },
    { id: "b", date: new Date(2026, 10, 15, 9) },
    { id: "c", date: new Date(2026, 10, 12, 9) },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].items.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(groups[1].items.map((item) => item.id), ["c"]);
});

test("formatRelative produces a relative label", () => {
  const label = formatRelative(NOW - 3 * 24 * 3600 * 1000, "en-GB", NOW);
  assert.equal(label, "3 days ago");
  assert.equal(formatRelative(null, "en-GB", NOW), "");
});

test("API error helpers", async () => {
  assert.equal(getApiErrorMessage({ response: { data: { message: "Oops" } } }, "fb"), "Oops");
  assert.equal(getApiErrorMessage({}, "fb"), "fb");
  assert.equal(isNetworkError({ message: "Network Error" }), true);
  assert.equal(isNetworkError({ code: "ERR_CANCELED" }), false);
  const blob = new Blob([JSON.stringify({ message: "Introuvable", code: "DOCUMENT_UNAVAILABLE" })], { type: "application/json" });
  assert.deepEqual(await readBlobError({ response: { data: blob } }), { message: "Introuvable", code: "DOCUMENT_UNAVAILABLE" });
});
