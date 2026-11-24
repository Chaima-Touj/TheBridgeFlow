import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { validateContactMessage, contactDedupKey } from "../utils/validateContactMessage.js";
import {
  buildFilters, buildStatusUpdate, contactMessageDocument,
} from "../controllers/eventParticipationRequests.controller.js";
import { splitFullName } from "../services/legacyContactMigration.service.js";
import EventParticipationRequest from "../models/eventParticipationRequest.model.js";

const valid = {
  name: "  Sarra   Ben  Ali ",
  email: " SARRA@Example.com ",
  subject: "  Demande   de stage  PFE ",
  message: "  Bonjour,\n\nJe souhaite  un stage.\n  Merci  ",
};

test("normalizes a valid message and ignores unknown fields", () => {
  assert.deepEqual(validateContactMessage({ ...valid, status: "confirmed", source: "form", hack: 1 }), {
    name: "Sarra Ben Ali",
    email: "sarra@example.com",
    subject: "Demande de stage PFE",
    // Seuls le début et la fin sont nettoyés : retours à la ligne et espaces du texte conservés.
    message: "Bonjour,\n\nJe souhaite  un stage.\n  Merci",
  });
});

test("accepts the maximum lengths", () => {
  const data = validateContactMessage({
    name: "n".repeat(120), email: `${"a".repeat(240)}@gmail.com`, subject: "s".repeat(180), message: "m".repeat(5000),
  });
  assert.equal(data.name.length, 120);
  assert.equal(data.email.length, 250);
  assert.equal(data.subject.length, 180);
  assert.equal(data.message.length, 5000);
});

test("rejects each missing, malformed or too long field with its field name", () => {
  const cases = [
    [{ ...valid, name: undefined }, "name"],
    [{ ...valid, name: "   " }, "name"],
    [{ ...valid, name: "n".repeat(121) }, "name"],
    [{ ...valid, email: "" }, "email"],
    [{ ...valid, email: "pas-un-email" }, "email"],
    [{ ...valid, email: "victim@school.tn?bcc=spy%40evil.com" }, "email"],
    [{ ...valid, email: `${"a".repeat(250)}@gmail.com` }, "email"],
    [{ ...valid, subject: "" }, "subject"],
    [{ ...valid, subject: "s".repeat(181) }, "subject"],
    [{ ...valid, message: "\n \n" }, "message"],
    [{ ...valid, message: "m".repeat(5001) }, "message"],
  ];
  for (const [input, field] of cases) {
    assert.throws(
      () => validateContactMessage(input),
      (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR" && error.field === field && /[a-zé]/.test(error.message),
      field,
    );
  }
});

test("rejects injection objects and non-string values", () => {
  for (const field of ["name", "email", "subject", "message"]) {
    for (const value of [{ $ne: 1 }, { $gt: "" }, ["x"], 42, true]) {
      assert.throws(() => validateContactMessage({ ...valid, [field]: value }), (error) => error.field === field, `${field} ${JSON.stringify(value)}`);
    }
  }
  for (const input of [null, undefined, "texte", [], 3]) {
    assert.throws(() => validateContactMessage(input), (error) => error.statusCode === 400 && error.code === "VALIDATION_ERROR");
  }
});

test("dedup key ignores case, accents and spacing but not the content", () => {
  const base = validateContactMessage(valid);
  const key = contactDedupKey(base);
  assert.match(key, /^[a-f\d]{64}$/);
  assert.equal(contactDedupKey({ ...base, name: "SARRA ben ali", email: "Sarra@example.com" }), key);
  assert.equal(contactDedupKey({ ...base, name: "Sârra Bén Ali", subject: "demande de  stage pfe" }), key);
  assert.equal(contactDedupKey({ ...base, message: "bonjour, je souhaite un stage. merci" }), key);
  assert.notEqual(contactDedupKey({ ...base, message: "Bonjour, je souhaite un stage d'été. Merci" }), key);
  assert.notEqual(contactDedupKey({ ...base, subject: "Demande de stage" }), key);
  assert.notEqual(contactDedupKey({ ...base, name: "Sarra Ben Salah" }), key);
  assert.notEqual(contactDedupKey({ ...base, email: "sarra@example.tn" }), key);
});

test("a contact message is stored as a valid site message", async () => {
  const data = validateContactMessage(valid);
  const doc = contactMessageDocument(data);
  assert.deepEqual(doc, {
    source: "contact", firstName: "Sarra", lastName: "Ben Ali", email: "sarra@example.com",
    subject: "Demande de stage PFE", message: "Bonjour,\n\nJe souhaite  un stage.\n  Merci",
    interestKey: "contact", status: "new", dedupKey: contactDedupKey(data),
  });
  // Validation du modèle (sans base de données) : téléphone, établissement et niveau non requis.
  await new EventParticipationRequest(doc).validate();
  // Nom le plus long accepté par le formulaire : jamais tronqué ni refusé par le modèle.
  const longName = contactMessageDocument(validateContactMessage({ ...valid, name: "x".repeat(120) }));
  assert.equal(longName.firstName.length, 120);
  await new EventParticipationRequest(longName).validate();
  const longParts = contactMessageDocument(validateContactMessage({ ...valid, name: `a ${"b".repeat(118)}` }));
  assert.equal(longParts.lastName.length, 118);
  await new EventParticipationRequest(longParts).validate();
});

test("a re-opened contact message gets back the key it had when it was sent", () => {
  const data = validateContactMessage(valid);
  const { dedupKey, ...stored } = contactMessageDocument(data);
  assert.equal(dedupKey, contactDedupKey(data));
  const userId = new mongoose.Types.ObjectId();
  const now = new Date("2026-11-24T10:00:00Z");

  const reopened = buildStatusUpdate(stored, "contacted", userId, now);
  assert.deepEqual(reopened, { $set: { status: "contacted", statusUpdatedAt: now, statusUpdatedBy: userId, dedupKey: contactDedupKey(data) } });
  // Confirmé : empreinte retirée.
  assert.deepEqual(buildStatusUpdate(stored, "confirmed", userId, now), {
    $set: { status: "confirmed", statusUpdatedAt: now, statusUpdatedBy: userId }, $unset: { dedupKey: 1 },
  });
  // Empreinte déjà présente : inchangée.
  assert.equal(buildStatusUpdate({ ...stored, dedupKey: "abc" }, "new", userId, now).$set.dedupKey, undefined);
  // Ancien message repris par la migration et demande de participation : jamais d'empreinte.
  assert.equal(buildStatusUpdate({ ...stored, legacyContactId: new mongoose.Types.ObjectId() }, "new", userId, now).$set.dedupKey, undefined);
  assert.equal(buildStatusUpdate({ ...stored, source: "form" }, "new", userId, now).$set.dedupKey, undefined);
  assert.equal(buildStatusUpdate({ ...stored, source: undefined }, "contacted", userId, now).$set.dedupKey, undefined);
});

test("a long full name is split without truncation", () => {
  const name = `${"a".repeat(60)} ${"b".repeat(59)}`;
  const { firstName, lastName } = splitFullName(validateContactMessage({ ...valid, name }).name);
  assert.equal(firstName.length, 60);
  assert.equal(lastName.length, 59);
});

test("list filter by type", () => {
  const notContact = { $ne: "contact" };
  assert.deepEqual(buildFilters({}).base, {});
  assert.deepEqual(buildFilters({ event: "contact" }).base, { source: "contact" });
  assert.deepEqual(buildFilters({ event: "participation" }).base, { source: notContact });
  assert.deepEqual(buildFilters({ event: "upcoming" }).base, { notifyUpcoming: true });
  assert.deepEqual(buildFilters({ event: "none" }).base, { eventId: null, notifyUpcoming: false, source: notContact });
  const eventId = "0123456789abcdef01234567";
  assert.equal(String(buildFilters({ event: eventId }).base.eventId), eventId);
  // Valeurs inconnues ou injectées : aucun filtre.
  assert.deepEqual(buildFilters({ event: { $ne: null } }).base, {});
  assert.deepEqual(buildFilters({ event: "../x" }).base, {});
  // Statut : seulement les valeurs connues, appliqué à la liste mais pas aux compteurs.
  const { base, withStatus } = buildFilters({ event: "contact", status: "contacted" });
  assert.deepEqual(base, { source: "contact" });
  assert.deepEqual(withStatus, { source: "contact", status: "contacted" });
  assert.deepEqual(buildFilters({ status: "archived" }).withStatus, {});
});
