import assert from "node:assert/strict";
import test from "node:test";
import { buildFieldSearch, getContextSearchTerms } from "./aiContextSearch.js";

test("extracts formation-specific words from French price questions", () => {
  assert.deepEqual(getContextSearchTerms("Quel est le tarif de la formation Marketing Digital ?"), ["marketing", "digital"]);
});

test("extracts event or offer names without generic request words", () => {
  assert.deepEqual(getContextSearchTerms("Quelles offres de stage en cybersécurité à Sousse ?"), ["cybersécurité", "sousse"]);
  assert.deepEqual(getContextSearchTerms("Durée de la formation IoT ?"), ["iot"]);
});

test("builds an escaped MongoDB field query that requires each term", () => {
  assert.deepEqual(buildFieldSearch(["data", "science"], ["title", "domain"]), {
    $and: [
      { $or: [{ title: { $regex: "data", $options: "i" } }, { domain: { $regex: "data", $options: "i" } }] },
      { $or: [{ title: { $regex: "science", $options: "i" } }, { domain: { $regex: "science", $options: "i" } }] },
    ],
  });
  assert.equal(buildFieldSearch(["a.*"], ["title"]).$and[0].$or[0].title.$regex, "a\\.\\*");
});
