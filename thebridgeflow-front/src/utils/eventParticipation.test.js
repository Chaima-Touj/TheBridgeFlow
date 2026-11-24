import test from "node:test";
import assert from "node:assert/strict";
import { LEGACY_STUDY_LEVELS, isContactMessage, replyMailtoHref, studyLevelLabel } from "./eventParticipation.js";

test("study level label: free text as typed, old list codes translated", () => {
  const t = (key) => `T(${key})`;
  assert.equal(studyLevelLabel("Master 1", t), "Master 1");
  assert.equal(studyLevelLabel(" Licence 2 ", t), "Licence 2");
  assert.equal(studyLevelLabel("bac3", t), "T(adminParticipation.levels.bac3)");
  for (const code of LEGACY_STUDY_LEVELS) assert.equal(studyLevelLabel(code, t), `T(adminParticipation.levels.${code})`);
  assert.equal(studyLevelLabel("", t), "");
  assert.equal(studyLevelLabel(undefined, t), "");
});

test("contact messages are told apart from participation requests", () => {
  assert.equal(isContactMessage({ source: "contact" }), true);
  assert.equal(isContactMessage({ source: "form" }), false);
  assert.equal(isContactMessage({}), false);
  assert.equal(isContactMessage(null), false);
});

test("reply link: encoded address, subject only for a contact message", () => {
  assert.equal(
    replyMailtoHref({ source: "contact", email: "sarra@mail.tn", subject: "Stage & PFE ?" }, "Re :"),
    "mailto:sarra@mail.tn?subject=Re%20%3A%20Stage%20%26%20PFE%20%3F",
  );
  assert.equal(replyMailtoHref({ source: "contact", email: "sarra@mail.tn", subject: "  " }, "Re :"), "mailto:sarra@mail.tn");
  assert.equal(replyMailtoHref({ source: "form", email: "sarra@mail.tn", subject: "x" }, "Re :"), "mailto:sarra@mail.tn");
  // Aucun paramètre injecté par l'adresse.
  assert.equal(
    replyMailtoHref({ source: "form", email: "victim@school.tn?bcc=spy@evil.com&body=Hi" }, "Re :"),
    "mailto:victim@school.tn%3Fbcc%3Dspy@evil.com%26body%3DHi",
  );
});
