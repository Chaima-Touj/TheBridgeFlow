export function isSafeContentUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const url = value.trim();
  if (/^\/(?![\\/])/.test(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
