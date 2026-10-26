import assert from "node:assert/strict";
import test from "node:test";
import {
  createUnsubscribeToken,
  decryptUnsubscribeToken,
  encryptUnsubscribeToken,
  hashUnsubscribeToken,
  normalizeNewsletterEmail,
  normalizeNewsletterLanguage,
} from "./newsletterToken.js";

test("normalizes and validates subscriber addresses", () => {
  assert.equal(normalizeNewsletterEmail("  HELLO@example.com "), "hello@example.com");
  assert.equal(normalizeNewsletterEmail("invalid"), null);
  assert.equal(normalizeNewsletterEmail("x".repeat(250) + "@example.com"), null);
});

test("uses unpredictable unsubscribe tokens and stores only a hash for lookup", () => {
  const first = createUnsubscribeToken();
  const second = createUnsubscribeToken();
  assert.equal(first.length, 43);
  assert.notEqual(first, second);
  assert.notEqual(hashUnsubscribeToken(first), first);
});

test("encrypts unsubscribe tokens for retryable email delivery", () => {
  process.env.JWT_SECRET = "test-only-key";
  const token = createUnsubscribeToken();
  const encrypted = encryptUnsubscribeToken(token);
  assert.notEqual(encrypted.encryptedToken, token);
  assert.equal(decryptUnsubscribeToken(encrypted), token);
  assert.equal(normalizeNewsletterLanguage("ar-TN"), "ar");
  assert.equal(normalizeNewsletterLanguage("unknown"), "fr");
});
