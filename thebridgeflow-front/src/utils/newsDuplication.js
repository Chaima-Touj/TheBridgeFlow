export function buildNewsDuplicateDraft(article, copySuffix) {
  const suffix = ` (${copySuffix})`;
  return {
    title: `${(article.title || "").slice(0, Math.max(0, 300 - suffix.length)).trim()}${suffix}`,
    excerpt: article.excerpt || "",
    content: article.content || "",
    conclusion: article.conclusion || "",
    ctaLabel: article.ctaLabel || "",
    ctaUrl: article.ctaUrl || "",
    faq: Array.isArray(article.faq)
      ? article.faq.map(({ question = "", answer = "" }) => ({ question, answer }))
      : [],
    metaTitle: article.metaTitle || "",
    metaDescription: article.metaDescription || "",
    articleUrl: "",
    category: article.category || "",
    publishedAt: new Date().toISOString().slice(0, 10),
    status: "draft",
    image: article.image || "",
  };
}
