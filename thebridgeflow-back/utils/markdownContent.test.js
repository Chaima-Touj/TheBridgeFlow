import assert from "node:assert/strict";
import test from "node:test";
import { containsRawHtml } from "./markdownContent.js";

test("identifies potentially executable raw HTML tags in Markdown", () => {
  assert.equal(containsRawHtml("<script>alert(1)</script>"), true);
  assert.equal(containsRawHtml('<img src=x onerror="alert(1)">'), true);
  assert.equal(containsRawHtml("## Section\n\n**Texte** et [lien](https://example.com)"), false);
  assert.equal(containsRawHtml("<https://example.com>"), false);
  assert.equal(containsRawHtml("2 < 3"), false);
});
