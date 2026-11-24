import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { validatePfePackRegistration } from "../utils/validatePfePackRegistration.js";
import PfePackRegistration from "../models/pfePackRegistration.model.js";
import {
  serializePfePackRegistration, updatePfePackRegistrationStatus, getPfePackRegistrationById,
} from "../controllers/pfePackRegistration.controller.js";

const validInput = {
  firstName: "  Sara ",
  lastName: " Ben Ali ",
  phone: "+216 20 000 000",
  email: "SARA@example.com",
  university: " Université de Tunis ",
  city: " Tunis ",
  technologies: [" React ", "Node.js", "React"],
  locationMode: "onsite",
  preferredLocation: "LAC1 – Tunis",
  consentConfirmed: true,
  subject: "Application de gestion",
};

test("normalizes a valid Pack PFE request", () => {
  assert.deepEqual(validatePfePackRegistration(validInput), {
    ...validInput,
    firstName: "Sara",
    lastName: "Ben Ali",
    email: "sara@example.com",
    university: "Université de Tunis",
    city: "Tunis",
    technologies: ["React", "Node.js"],
    consentConfirmed: true,
    subject: "Application de gestion",
  });
});

test("rejects malformed or incomplete registration fields", () => {
  for (const input of [
    { ...validInput, firstName: " " },
    { ...validInput, email: "not-an-email" },
    { ...validInput, technologies: [] },
    { ...validInput, technologies: ["React"] },
    { ...validInput, technologies: ["React", "React"] },
    { ...validInput, university: "" },
    { ...validInput, city: "" },
    { ...validInput, locationMode: "onsite", preferredLocation: "" },
    { ...validInput, consentConfirmed: false },
    { ...validInput, subject: "x".repeat(3001) },
  ]) {
    assert.throws(() => validatePfePackRegistration(input), { statusCode: 400 });
  }
});

test("remote requests do not keep an onsite location", () => {
  const result = validatePfePackRegistration({ ...validInput, locationMode: "remote", preferredLocation: "LAC1 – Tunis" });
  assert.equal(result.locationMode, "remote");
  assert.equal(result.preferredLocation, "");
});

test("accepts requests without a PFE subject", () => {
  const { subject, ...inputWithoutSubject } = validInput;
  assert.equal("subject" in validatePfePackRegistration(inputWithoutSubject), false);
});

/* ── Suivi des demandes (statut) ─────────────────────────────────────────── */
const adminId = new mongoose.Types.ObjectId();
const registrationId = new mongoose.Types.ObjectId();
// Demande enregistrée avant l'ajout du suivi : aucun champ de statut.
const storedRegistration = {
  _id: registrationId,
  firstName: "Sara",
  lastName: "Ben Ali",
  phone: "+216 20 000 000",
  email: "sara@example.com",
  university: "Université de Tunis",
  city: "Tunis",
  technologies: ["React", "Node.js"],
  locationMode: "onsite",
  preferredLocation: "LAC1 – Tunis",
  subject: "Application de gestion",
  consentConfirmed: true,
  createdAt: new Date("2026-11-20T09:30:00Z"),
  updatedAt: new Date("2026-11-20T09:30:00Z"),
  __v: 0,
};

test("a visitor can never set the follow-up status on the public form", () => {
  const result = validatePfePackRegistration({
    ...validInput,
    status: "confirmed",
    statusUpdatedAt: "2026-01-01T00:00:00Z",
    statusUpdatedBy: adminId.toString(),
    _id: registrationId.toString(),
    createdAt: "2020-01-01T00:00:00Z",
  });
  for (const field of ["status", "statusUpdatedAt", "statusUpdatedBy", "_id", "createdAt"]) {
    assert.equal(field in result, false, field);
  }
  // Une demande enregistrée avec ces données est donc « new ».
  const doc = new PfePackRegistration(result);
  assert.equal(doc.status, "new");
  assert.equal(doc.statusUpdatedAt, null);
  assert.equal(doc.statusUpdatedBy, null);
});

test("the model only accepts the shared follow-up statuses", async () => {
  const data = validatePfePackRegistration(validInput);
  await new PfePackRegistration({ ...data, status: "contacted" }).validate();
  await assert.rejects(new PfePackRegistration({ ...data, status: "archived" }).validate(), { name: "ValidationError" });
});

test("requests saved before the follow-up existed are serialised as new", () => {
  assert.equal(serializePfePackRegistration(storedRegistration).status, "new");
  assert.equal(serializePfePackRegistration({ ...storedRegistration, status: "unknown" }).status, "new");
  assert.equal(serializePfePackRegistration({ ...storedRegistration, status: null }).status, "new");
  assert.equal(serializePfePackRegistration({ ...storedRegistration, status: "confirmed" }).status, "confirmed");
  assert.equal(serializePfePackRegistration(storedRegistration).statusUpdatedAt, null);
});

test("the list item contains what the dashboard list needs, and nothing more", () => {
  assert.deepEqual(serializePfePackRegistration(storedRegistration), {
    _id: registrationId,
    firstName: "Sara",
    lastName: "Ben Ali",
    email: "sara@example.com",
    phone: "+216 20 000 000",
    university: "Université de Tunis",
    city: "Tunis",
    technologies: ["React", "Node.js"],
    locationMode: "onsite",
    preferredLocation: "LAC1 – Tunis",
    status: "new",
    statusUpdatedAt: null,
    createdAt: storedRegistration.createdAt,
  });
});

test("the detail serialises the subject, the consent and who changed the status", () => {
  const updatedAt = new Date("2026-11-21T10:00:00Z");
  const detail = serializePfePackRegistration({
    ...storedRegistration,
    status: "contacted",
    statusUpdatedAt: updatedAt,
    statusUpdatedBy: { _id: adminId, name: "Admin TBF", email: "admin@example.com", password: "hash" },
  }, { detail: true });
  assert.equal(detail.subject, "Application de gestion");
  assert.equal(detail.consentConfirmed, true);
  assert.equal(detail.status, "contacted");
  assert.equal(detail.statusUpdatedAt, updatedAt);
  assert.deepEqual(detail.statusUpdatedBy, { _id: adminId, name: "Admin TBF" });
  assert.equal("__v" in detail, false);
  assert.equal("updatedAt" in detail, false);

  // Jamais modifié, ou administrateur supprimé depuis (populate → null).
  assert.equal(serializePfePackRegistration(storedRegistration, { detail: true }).statusUpdatedBy, null);
  assert.equal(serializePfePackRegistration({ ...storedRegistration, statusUpdatedBy: null }, { detail: true }).statusUpdatedBy, null);
  const { subject, ...withoutSubject } = storedRegistration;
  assert.equal(serializePfePackRegistration(withoutSubject, { detail: true }).subject, "");
});

// Exécute un handler Express (asyncHandler) et attend sa réponse ou son erreur.
function run(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); },
    };
    handler(req, res, (error) => resolve({ error }));
  });
}

// Remplace temporairement une méthode du modèle (aucune base de données).
function stubModel(method, implementation) {
  const original = PfePackRegistration[method];
  PfePackRegistration[method] = implementation;
  return () => { PfePackRegistration[method] = original; };
}
const query = (result) => ({ populate: () => ({ lean: async () => result }) });

test("PATCH /:id/status rejects a bad id or an unknown status before touching the database", async () => {
  let calls = 0;
  const restore = stubModel("findByIdAndUpdate", () => { calls += 1; return query(null); });
  try {
    const badId = await run(updatePfePackRegistrationStatus, { params: { id: "123" }, body: { status: "new" }, user: { _id: adminId } });
    assert.equal(badId.error.statusCode, 400);
    assert.equal(badId.error.message, "Identifiant de demande invalide.");
    for (const status of [undefined, "", "archived", ["new"], { $ne: "new" }, 1]) {
      const result = await run(updatePfePackRegistrationStatus, { params: { id: registrationId.toString() }, body: { status }, user: { _id: adminId } });
      assert.equal(result.error.statusCode, 400, JSON.stringify(status));
      assert.equal(result.error.message, "Statut invalide.");
    }
    const noBody = await run(updatePfePackRegistrationStatus, { params: { id: registrationId.toString() }, user: { _id: adminId } });
    assert.equal(noBody.error.message, "Statut invalide.");
    assert.equal(calls, 0);
  } finally {
    restore();
  }
});

test("PATCH /:id/status returns 404 for a missing request", async () => {
  const restore = stubModel("findByIdAndUpdate", () => query(null));
  try {
    const result = await run(updatePfePackRegistrationStatus, { params: { id: registrationId.toString() }, body: { status: "confirmed" }, user: { _id: adminId } });
    assert.equal(result.error.statusCode, 404);
  } finally {
    restore();
  }
});

test("PATCH /:id/status records who changed the status and when", async () => {
  let received;
  const restore = stubModel("findByIdAndUpdate", (id, update, options) => {
    received = { id, update, options };
    return query({ ...storedRegistration, ...update.$set, statusUpdatedBy: { _id: adminId, name: "Admin TBF" } });
  });
  try {
    const before = Date.now();
    const result = await run(updatePfePackRegistrationStatus, { params: { id: registrationId.toString() }, body: { status: "confirmed" }, user: { _id: adminId } });
    assert.equal(result.error, undefined);
    assert.equal(received.id, registrationId.toString());
    assert.deepEqual(received.options, { returnDocument: "after", runValidators: true });
    assert.deepEqual(Object.keys(received.update), ["$set"]);
    assert.equal(received.update.$set.status, "confirmed");
    assert.equal(received.update.$set.statusUpdatedBy, adminId);
    assert.ok(received.update.$set.statusUpdatedAt instanceof Date);
    assert.ok(received.update.$set.statusUpdatedAt.getTime() >= before);
    assert.equal(result.body.registration.status, "confirmed");
    assert.deepEqual(result.body.registration.statusUpdatedBy, { _id: adminId, name: "Admin TBF" });
    assert.equal(result.body.registration.subject, "Application de gestion");
  } finally {
    restore();
  }
});

test("GET /:id rejects a bad id and serialises an old request as new", async () => {
  const restore = stubModel("findById", () => query(storedRegistration));
  try {
    const badId = await run(getPfePackRegistrationById, { params: { id: "not-an-id" } });
    assert.equal(badId.error.statusCode, 400);
    const result = await run(getPfePackRegistrationById, { params: { id: registrationId.toString() } });
    assert.equal(result.body.status, "new");
    assert.equal(result.body.statusUpdatedBy, null);
    assert.equal(result.body.consentConfirmed, true);
  } finally {
    restore();
  }
});
