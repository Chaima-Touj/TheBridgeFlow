import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to encrypt newsletter tokens.");
  return createHash("sha256").update(secret).digest();
}

export function createUnsubscribeToken() {
  return randomBytes(32).toString("base64url");
}

export function hashUnsubscribeToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function encryptUnsubscribeToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encryptedToken = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    encryptedToken: encryptedToken.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenAuthTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptUnsubscribeToken({ encryptedToken, tokenIv, tokenAuthTag }) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(tokenIv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tokenAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedToken, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function normalizeNewsletterEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeNewsletterLanguage(value) {
  const language = typeof value === "string" ? value.toLowerCase().split("-")[0] : "";
  return ["fr", "en", "ar"].includes(language) ? language : "fr";
}
