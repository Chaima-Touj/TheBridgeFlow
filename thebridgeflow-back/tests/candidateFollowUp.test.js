import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  computeGlobalStatus, buildGlobalStatusSwitch, GLOBAL_STATUS_RULES, isTaskOverdue, summarizeTasks,
  validateTaskInput, parseListQuery, parseTaskQuery, escapeRegex, parseDocumentKey, resolveLocalUpload,
  buildContentDisposition, ensureExtension, fileExtension, safeHttpUrl, truncateText,
} from "../utils/candidateFollowUp.js";

const NOW = new Date("2026-11-16T12:00:00Z");
const base = { applicationsCount: 1, acceptedCount: 0, refusedCount: 0, inReviewCount: 0, upcomingInterviews: 0, tasksTotal: 0 };

test("computeGlobalStatus follows the documented precedence", () => {
  assert.equal(computeGlobalStatus(base), "new");
  assert.equal(computeGlobalStatus({ ...base, tasksTotal: 2 }), "in_progress");
  assert.equal(computeGlobalStatus({ ...base, inReviewCount: 1 }), "in_progress");
  assert.equal(computeGlobalStatus({ ...base, applicationsCount: 2, refusedCount: 2, tasksTotal: 3 }), "rejected");
  assert.equal(computeGlobalStatus({ ...base, applicationsCount: 2, refusedCount: 1 }), "new");
  assert.equal(computeGlobalStatus({ ...base, upcomingInterviews: 1, inReviewCount: 1 }), "interview");
  assert.equal(computeGlobalStatus({ ...base, applicationsCount: 3, acceptedCount: 1, upcomingInterviews: 1, refusedCount: 2 }), "accepted");
  assert.equal(computeGlobalStatus({}), "new");
});

test("aggregation $switch mirrors the JS rules in the same order", () => {
  const expr = buildGlobalStatusSwitch({
    applicationsCount: "$a", acceptedCount: "$b", refusedCount: "$c", inReviewCount: "$d", upcomingInterviews: "$e", tasksTotal: "$f",
  });
  assert.deepEqual(expr.$switch.branches.map((branch) => branch.then), GLOBAL_STATUS_RULES.map((rule) => rule.status));
  assert.deepEqual(expr.$switch.branches.map((branch) => branch.then), ["accepted", "interview", "rejected", "in_progress"]);
  assert.equal(expr.$switch.default, "new");
  const serialized = JSON.stringify(expr.$switch.branches[3].case);
  assert.ok(serialized.includes("$d") && serialized.includes("$f"));
});

test("overdue and summary", () => {
  assert.equal(isTaskOverdue({ status: "pending", dueDate: "2026-11-15T00:00:00Z" }, NOW), true);
  assert.equal(isTaskOverdue({ status: "completed", dueDate: "2026-11-15T00:00:00Z" }, NOW), false);
  assert.equal(isTaskOverdue({ status: "pending", dueDate: null }, NOW), false);
  assert.deepEqual(summarizeTasks([
    { status: "pending", dueDate: "2026-11-10T00:00:00Z" },
    { status: "in_progress", dueDate: "2026-11-20T00:00:00Z" },
    { status: "completed", dueDate: null },
  ], NOW), { total: 3, pending: 1, in_progress: 1, completed: 1, overdue: 1, nextDueAt: "2026-11-20T00:00:00.000Z" });
});

test("validateTaskInput normalizes a creation and ignores unknown fields", () => {
  const { updates, clientRequestId } = validateTaskInput({
    type: "call", title: "  Appel  ", description: "  ok ", studentId: "x", createdBy: "y",
    dueDate: "2026-11-20T10:00:00.000Z", applicationId: "a".repeat(24), clientRequestId: "abc-12345678",
  }, { now: NOW });
  assert.equal(updates.title, "Appel");
  assert.equal(updates.description, "ok");
  assert.equal(updates.status, "pending");
  assert.ok(updates.activityDate instanceof Date);
  assert.equal(updates.studentId, undefined);
  assert.equal(updates.createdBy, undefined);
  assert.equal(clientRequestId, "abc-12345678");
});

test("validateTaskInput rejects invalid data", () => {
  const bad = [
    {}, { type: "hack", title: "x" }, { type: "call" }, { type: "call", title: "  " },
    { type: "call", title: "x".repeat(161) }, { type: "call", title: "x", description: "y".repeat(5001) },
    { type: "call", title: "x", activityDate: "nope" }, { type: "call", title: "x", dueDate: "1990-01-01" },
    { type: "call", title: "x", dueDate: "2099-01-01" }, { type: "call", title: "x", status: "done" },
    { type: "call", title: "x", applicationId: "123" }, { type: "call", title: {} },
    { type: "call", title: "x", clientRequestId: "<script>" },
  ];
  for (const body of bad) assert.throws(() => validateTaskInput(body, { now: NOW }), { statusCode: 400 }, JSON.stringify(body));
  assert.throws(() => validateTaskInput(null, { now: NOW }), { statusCode: 400 });
  assert.throws(() => validateTaskInput([], { now: NOW }), { statusCode: 400 });
});

test("completion requires explicit confirmation, except for notes", () => {
  assert.throws(
    () => validateTaskInput({ type: "whatsapp", title: "x", status: "completed" }, { now: NOW }),
    { statusCode: 400, code: "COMPLETION_CONFIRMATION_REQUIRED" },
  );
  assert.equal(validateTaskInput({ type: "whatsapp", title: "x", status: "completed", confirmCompletion: true }, { now: NOW }).updates.status, "completed");
  assert.throws(
    () => validateTaskInput({ type: "call", title: "x", status: "completed", confirmCompletion: "true" }, { now: NOW }),
    { code: "COMPLETION_CONFIRMATION_REQUIRED" },
    "string 'true' is not a confirmation",
  );
  assert.equal(validateTaskInput({ type: "note", title: "x" }, { now: NOW }).updates.status, "completed");
  assert.equal(validateTaskInput({ type: "note", title: "x", status: "pending" }, { now: NOW }).updates.status, "completed");
  const existing = { type: "call", status: "pending" };
  assert.throws(() => validateTaskInput({ status: "completed" }, { partial: true, existing, now: NOW }), { code: "COMPLETION_CONFIRMATION_REQUIRED" });
  assert.equal(validateTaskInput({ status: "completed", confirmCompletion: true }, { partial: true, existing, now: NOW }).updates.status, "completed");
  assert.deepEqual(validateTaskInput({ title: "Nouveau" }, { partial: true, existing: { type: "call", status: "completed" }, now: NOW }).updates, { title: "Nouveau" });
  assert.equal(validateTaskInput({ type: "note" }, { partial: true, existing, now: NOW }).updates.status, "completed");
});

test("validateTaskInput partial update handling", () => {
  const { updates, expectedUpdatedAt } = validateTaskInput(
    { dueDate: null, applicationId: null, expectedUpdatedAt: "2026-11-16T10:00:00.000Z" },
    { partial: true, existing: { type: "call", status: "pending" }, now: NOW },
  );
  assert.deepEqual(updates, { dueDate: null, applicationId: null });
  assert.equal(expectedUpdatedAt.toISOString(), "2026-11-16T10:00:00.000Z");
  assert.throws(() => validateTaskInput({ expectedUpdatedAt: "bad" }, { partial: true, existing: { type: "call", status: "pending" }, now: NOW }), { statusCode: 400 });
});

test("parseListQuery coerces hostile or missing values", () => {
  assert.deepEqual(parseListQuery({}), { search: "", filter: "all", sort: "recent", page: 1, limit: 10 });
  assert.deepEqual(parseListQuery({ search: "  Ahmed ", filter: "overdue", sort: "name", page: "3", limit: "25" }),
    { search: "Ahmed", filter: "overdue", sort: "name", page: 3, limit: 25 });
  assert.deepEqual(parseListQuery({ search: ["a"], filter: { $ne: 1 }, sort: "x", page: "-1", limit: "999" }),
    { search: "", filter: "all", sort: "recent", page: 1, limit: 10 });
  assert.equal(parseListQuery({ search: "x".repeat(300) }).search.length, 100);
  assert.deepEqual(parseTaskQuery({ status: "completed", type: "call", applicationId: "none", overdue: "true" }),
    { status: "completed", type: "call", applicationId: "none", overdue: true });
  assert.deepEqual(parseTaskQuery({ status: { $ne: 1 }, type: "x", applicationId: "1" }),
    { status: null, type: null, applicationId: null, overdue: false });
});

test("escapeRegex neutralizes regex syntax", () => {
  assert.equal(new RegExp(escapeRegex("(.*[")).test("(.*["), true);
  assert.equal(new RegExp(escapeRegex("a.b")).test("axb"), false);
});

test("parseDocumentKey", () => {
  const id = "0123456789abcdef01234567";
  assert.deepEqual(parseDocumentKey("profile-cv"), { kind: "cv", source: "profile", applicationId: null });
  assert.deepEqual(parseDocumentKey(`application-cv:${id}`), { kind: "cv", source: "application", applicationId: id });
  assert.deepEqual(parseDocumentKey(`cover-letter:${id}`), { kind: "coverLetter", source: "application", applicationId: id });
  for (const key of [undefined, "", "../../server.js", `application-cv:${id}x`, ["profile-cv"]]) assert.equal(parseDocumentKey(key), null);
});

test("resolveLocalUpload only accepts safe files inside uploads", () => {
  const dir = path.resolve("/srv/app/uploads");
  const ok = resolveLocalUpload("https://9antra.tn/uploads/cv-123-456.pdf", dir);
  assert.equal(ok.filePath, path.join(dir, "cv-123-456.pdf"));
  assert.equal(ok.contentType, "application/pdf");
  assert.equal(resolveLocalUpload("/uploads/cv-1.docx", dir).extension, "docx");
  for (const url of [
    "/uploads/../server.js", "/uploads/%2e%2e/server.js", "/uploads/sub/cv-1.pdf", "/uploads/cv-1.exe",
    "/uploads/msg-1.pdf", "/etc/passwd", "", null, "/uploads/cv-..pdf", "/uploads/cv-1.pdf/../../x.pdf",
  ]) assert.equal(resolveLocalUpload(url, dir), null, String(url));
});

test("content disposition is header-safe and keeps the UTF-8 name", () => {
  const header = buildContentDisposition("attachment", 'CV "Ahmed"\r\nX-Evil: 1 é.pdf');
  assert.ok(header.startsWith("attachment; filename=\""));
  assert.ok(!/[\r\n]/.test(header));
  assert.ok(header.includes("filename*=UTF-8''"));
  assert.ok(buildContentDisposition("weird", "a.pdf").startsWith("inline;"));
});

test("misc helpers", () => {
  assert.equal(ensureExtension("CV", "pdf"), "CV.pdf");
  assert.equal(ensureExtension("cv.PDF", "pdf"), "cv.PDF");
  assert.equal(fileExtension("https://x.tn/uploads/cv-1.docx"), "docx");
  assert.equal(fileExtension("file.exe"), "");
  assert.equal(safeHttpUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpUrl("https://example.com/a.pdf"), "https://example.com/a.pdf");
  assert.equal(truncateText("abcdef", 4), "abc…");
});
