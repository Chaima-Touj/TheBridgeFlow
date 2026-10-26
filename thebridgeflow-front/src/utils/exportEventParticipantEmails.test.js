import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildEventParticipantEmailsPdf,
  getEventParticipantEmails,
} from "./exportEventParticipantEmails.js";
import { isSafeContentUrl } from "./safeContentUrl.js";

const translate = (key, values = {}) => {
  const labels = {
    "events.emailsPdfTitle": "Emails des participants",
    "events.emailsPdfExportedOn": `Exporté le ${values.date}`,
    "events.emailsPdfCount": `${values.count} participant(s) inclus`,
    "events.emailsPdfEmailColumn": "Adresse email",
    "events.emailsPdfNoEmails": "Aucune adresse email disponible.",
  };
  return labels[key] || key;
};

test("includes only active registrations and deduplicates emails case-insensitively", () => {
  const emails = getEventParticipantEmails([
    { status: "registered", student: { email: " Etudiant@example.com " } },
    { status: "registered", student: { email: "etudiant@example.com" } },
    { status: "cancelled", student: { email: "annule@example.com" } },
    { status: "registered", student: { email: "" } },
    { status: "registered", student: null },
  ]);

  assert.deepEqual(emails, ["Etudiant@example.com"]);
});

test("builds a paginated PDF and an explicit event filename", () => {
  const registrations = Array.from({ length: 100 }, (_, index) => ({
    status: "registered",
    student: { email: `participant${index}@example.com` },
  }));
  const { doc, emails, filename } = buildEventParticipantEmailsPdf(
    { _id: "event-id", title: "Événement Exemple" },
    registrations,
    translate,
    "fr-FR",
  );
  const pdf = new Uint8Array(doc.output("arraybuffer"));

  assert.equal(emails.length, 100);
  assert.equal(filename, "participants-evenement-exemple.pdf");
  assert.equal(String.fromCharCode(...pdf.subarray(0, 5)), "%PDF-");
  assert.ok(doc.getNumberOfPages() > 1);
});

test("builds a valid PDF when no registered participant has an email", () => {
  const { doc, emails } = buildEventParticipantEmailsPdf(
    { _id: "event-id", title: "Sans participants" },
    [{ status: "registered", student: { email: " " } }],
    translate,
    "fr-FR",
  );

  assert.deepEqual(emails, []);
  const pdf = new Uint8Array(doc.output("arraybuffer"));
  assert.equal(String.fromCharCode(...pdf.subarray(0, 5)), "%PDF-");
});

test("builds a valid PDF when the event has no registrations", () => {
  const { doc, emails } = buildEventParticipantEmailsPdf(
    { _id: "event-id", title: "Aucun participant" },
    [],
    translate,
    "fr-FR",
  );

  assert.deepEqual(emails, []);
  const pdf = new Uint8Array(doc.output("arraybuffer"));
  assert.equal(String.fromCharCode(...pdf.subarray(0, 5)), "%PDF-");
});

test("sanitizes raw HTML and unsafe Markdown link protocols", () => {
  const source = "<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))";
  const rendered = renderToStaticMarkup(
    React.createElement(ReactMarkdown, { rehypePlugins: [rehypeSanitize] }, source),
  );

  assert.equal(rendered.includes("<script"), false);
  assert.equal(rendered.includes("javascript:"), false);
  assert.equal(rendered.includes("href="), false);
});

test("allows safe CTA paths and rejects executable or insecure URLs", () => {
  assert.equal(isSafeContentUrl("/formations"), true);
  assert.equal(isSafeContentUrl("https://thebridgeflow.example/formations"), true);
  assert.equal(isSafeContentUrl("javascript:alert(1)"), false);
  assert.equal(isSafeContentUrl("//external.example/path"), false);
  assert.equal(isSafeContentUrl("http://external.example/path"), false);
});
