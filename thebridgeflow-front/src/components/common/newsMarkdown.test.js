import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import ReactMarkdown from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";
import { newsMarkdownOptions } from "./newsMarkdown.js";

function renderMarkdown(content) {
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, newsMarkdownOptions, content),
  );
}

test("renders editorial Markdown structure and multilingual text as safe semantic HTML", () => {
  const content = [
    "# Étape 1 : Préparez votre candidature",
    "Votre CV doit être **clair et précis**.",
    "استعدّ جيدًا — Prepare well.",
    "Consultez [le site officiel](https://example.com/) pour plus d'informations.",
    "- Préparez votre CV",
    "- Vérifiez vos compétences",
    "1. Relisez votre dossier",
    "2. Envoyez-le",
    "> Une candidature claire aide.",
    "---",
    "## Section",
    "### Sous-section",
  ].join("\n\n");

  const rendered = renderMarkdown(content);

  assert.match(rendered, /<h2>Étape 1 : Préparez votre candidature<\/h2>/);
  assert.match(rendered, /<strong>clair et précis<\/strong>/);
  assert.match(rendered, /<h2>Section<\/h2>/);
  assert.match(rendered, /<h3>Sous-section<\/h3>/);
  assert.match(rendered, /<ul>[\s\S]*Préparez votre CV[\s\S]*Vérifiez vos compétences[\s\S]*<\/ul>/);
  assert.match(rendered, /<ol>[\s\S]*Relisez votre dossier[\s\S]*Envoyez-le[\s\S]*<\/ol>/);
  assert.match(rendered, /<a href="https:\/\/example\.com\/" rel="nofollow noopener noreferrer">le site officiel<\/a>/);
  assert.match(rendered, /<blockquote>/);
  assert.match(rendered, /<hr\/?>/);
  assert.match(rendered, /استعدّ جيدًا/);
});

test("sanitizes raw HTML and unsafe link protocols with the shared renderer options", () => {
  const rendered = renderMarkdown(
    '<img src=x onerror="alert(1)">\n\n[unsafe](javascript:alert(1))',
  );

  assert.equal(rendered.includes("<img"), false);
  assert.equal(rendered.includes("onerror"), false);
  assert.equal(rendered.includes("javascript:"), false);
  assert.equal(rendered.includes("href="), false);
});

test("keeps the article title as the sole H1 while Markdown headings start at H2", () => {
  const markdown = renderMarkdown("# Section\n\n## Subsection\n\n### Detail");
  const article = `<article><h1>Titre principal</h1>${markdown}</article>`;

  assert.equal((article.match(/<h1>/g) || []).length, 1);
  assert.match(article, /<h1>Titre principal<\/h1>\s*<h2>Section<\/h2>\s*<h2>Subsection<\/h2>\s*<h3>Detail<\/h3>/);
});
