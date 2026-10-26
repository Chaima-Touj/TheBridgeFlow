import assert from "node:assert/strict";
import test from "node:test";
import { buildNewsletterSubscribersPdf } from "./exportNewsletterSubscribersPdf.js";

const translate = (key, values = {}) => `${key} ${JSON.stringify(values)}`;

test("newsletter subscriber export produces a valid PDF with a paginated table", () => {
  const subscribers = Array.from({ length: 100 }, (_, index) => ({
    email: `subscriber-${index}@example.com`,
    subscribedAt: "2026-01-15T00:00:00.000Z",
  }));
  const doc = buildNewsletterSubscribersPdf(subscribers, translate, "fr");

  assert.match(doc.output(), /^%PDF-/);
  assert.ok(doc.internal.getNumberOfPages() > 1);
});

test("newsletter subscriber export handles an empty subscriber list", () => {
  const doc = buildNewsletterSubscribersPdf([], translate, "en");

  assert.match(doc.output(), /^%PDF-/);
  assert.equal(doc.internal.getNumberOfPages(), 1);
});
