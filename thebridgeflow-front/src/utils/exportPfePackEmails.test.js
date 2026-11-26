import test from "node:test";
import assert from "node:assert/strict";
import { buildPfePackEmailsPdf, getPfePackEmails, getPfePackEmailsExport } from "./exportPfePackEmails.js";

test("exports unique email addresses only", () => {
  assert.deepEqual(getPfePackEmails([
    { email: " sara@example.com ", firstName: "Sara" },
    { email: "SARA@example.com", lastName: "Ben Ali" },
    { email: "yassine@example.com", phone: "+216 20 000 000" },
    { email: "" },
  ]), ["sara@example.com", "yassine@example.com"]);
});

// Demande sans programme (enregistrée avant l'ajout du champ) : Pack PFE.
const registrations = [
  { email: "sara@example.com", program: "summer-camp" },
  { email: "yassine@example.com" },
  { email: "emna@example.com", program: "pfe-pack" },
  { email: "SARA@example.com", program: "pfe-pack" },
];

test("exports the emails of the selected program, every program for all", () => {
  assert.deepEqual(getPfePackEmails(registrations, { program: "summer-camp" }), ["sara@example.com"]);
  assert.deepEqual(getPfePackEmails(registrations, { program: "pfe-pack" }), ["yassine@example.com", "emna@example.com", "SARA@example.com"]);
  assert.deepEqual(getPfePackEmails(registrations, { program: "all" }), ["sara@example.com", "yassine@example.com", "emna@example.com"]);
  assert.deepEqual(getPfePackEmails(registrations), ["sara@example.com", "yassine@example.com", "emna@example.com"]);
});

test("the title and the file name match the selected program", () => {
  assert.deepEqual(getPfePackEmailsExport("pfe-pack"), { title: "Pack PFE - adresses e-mail", filename: "inscriptions-pack-pfe-emails.pdf" });
  assert.deepEqual(getPfePackEmailsExport("summer-camp"), { title: "Summer Camp - adresses e-mail", filename: "inscriptions-summer-camp-emails.pdf" });
  const all = { title: "Pack PFE & Summer Camp - adresses e-mail", filename: "inscriptions-pack-pfe-summer-camp-emails.pdf" };
  assert.deepEqual(getPfePackEmailsExport("all"), all);
  assert.deepEqual(getPfePackEmailsExport(), all);
  assert.deepEqual(getPfePackEmailsExport("toString"), all);
});

test("the PDF carries the program title and only that program's emails", () => {
  const { doc, emails, title, filename } = buildPfePackEmailsPdf(registrations, { program: "summer-camp" });
  assert.deepEqual(emails, ["sara@example.com"]);
  assert.equal(filename, "inscriptions-summer-camp-emails.pdf");
  const output = doc.output();
  assert.ok(output.includes(`/Title (${title})`));
  assert.ok(output.includes("sara@example.com"));
  assert.equal(output.includes("yassine@example.com"), false);
});
