import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  isLikelySpamContact, legacyContactToRequest, splitFullName,
} from "../services/legacyContactMigration.service.js";

test("robot messages made of random tokens are detected as spam", () => {
  const spam = [
    { name: "zg0mVul5Mp", subject: "ETSthMdqTT", message: "nIP2n02SmA8ZkVHKO5DtbbnNkhczDfrpPK0B" },
    { name: "BspzERcJli", subject: "9vc2W3z99Y", message: "Hello" },
    { name: "Ali", subject: "Info", message: "qWeRtYuIoPaSdFgHjKlZx" },
  ];
  for (const doc of spam) assert.equal(isLikelySpamContact(doc), true, JSON.stringify(doc));
});

test("real messages are kept, even short or with unusual names", () => {
  const real = [
    { name: "Gara Raouaa", subject: "Demande de stage PFE – 2027", message: "Bonjour, je suis étudiante en 5e année." },
    { name: "mohamed habib afine", subject: "Problème de réception du code de vérification", message: "Bonjour, je vous contacte car..." },
    { name: "McDonald", subject: "Question", message: "Merci" },
    { name: "Ahmed", subject: "PFE", message: "Disponible ?" },
    { name: "Emna Ben Slama", subject: "Demande de reprogrammation – Workshop", message: "Bonsoir Madame, Monsieur" },
    { name: "TheBridge", subject: "Stage2027", message: "Bonjour" },
  ];
  for (const doc of real) assert.equal(isLikelySpamContact(doc), false, JSON.stringify(doc));
});

test("full name is split into first and last name", () => {
  assert.deepEqual(splitFullName("  Gara   Raouaa "), { firstName: "Gara", lastName: "Raouaa" });
  assert.deepEqual(splitFullName("Mohamed Yassine Skik"), { firstName: "Mohamed", lastName: "Yassine Skik" });
  assert.deepEqual(splitFullName("Ahmed"), { firstName: "Ahmed", lastName: "" });
});

test("a legacy message keeps its content, email and original date", () => {
  const _id = new mongoose.Types.ObjectId();
  const createdAt = new Date("2026-11-20T12:32:16Z");
  const request = legacyContactToRequest({ _id, name: "Gara Raouaa", email: " Raoua.Gara@esprit.tn ", subject: "Demande de stage", message: "Bonjour", createdAt });
  assert.equal(request.source, "contact");
  assert.equal(request.legacyContactId, _id);
  assert.equal(request.email, "raoua.gara@esprit.tn");
  assert.equal(request.firstName, "Gara");
  assert.equal(request.lastName, "Raouaa");
  assert.equal(request.subject, "Demande de stage");
  assert.equal(request.message, "Bonjour");
  assert.equal(request.status, "new");
  assert.equal(request.createdAt, createdAt);
  assert.equal(legacyContactToRequest({ _id, name: "", email: "x@y.tn", subject: "s", message: "m" }).firstName, "x");
});
