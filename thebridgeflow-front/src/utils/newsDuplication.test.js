import assert from "node:assert/strict";
import test from "node:test";
import { buildNewsDuplicateDraft } from "./newsDuplication.js";

test("news duplication creates a draft without copying identity or publication metadata", () => {
  const draft = buildNewsDuplicateDraft({
    _id: "article-id",
    title: "News",
    excerpt: "Intro",
    content: "## Section",
    conclusion: "Conclusion",
    ctaLabel: "Learn more",
    ctaUrl: "/formations",
    faq: [{ question: "Question", answer: "Answer", _id: "faq-id" }],
    metaTitle: "SEO title",
    metaDescription: "SEO description",
    category: "Education",
    image: "https://example.com/image.jpg",
    status: "published",
    author: "Admin",
    views: 100,
  }, "copy");

  assert.equal(draft.status, "draft");
  assert.equal(draft.articleUrl, "");
  assert.equal(draft.faq[0].question, "Question");
  assert.equal("_id" in draft, false);
  assert.equal("author" in draft, false);
  assert.equal("views" in draft, false);
});
