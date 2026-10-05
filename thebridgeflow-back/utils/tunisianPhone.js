const TUNISIAN_MOBILE_PATTERN = /^2\d{7}$/;

export function normalizeTunisianPhone(value) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^(?:\+216\s*)?[\d\s]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\s/g, "").replace(/^\+216/, "");
  if (!TUNISIAN_MOBILE_PATTERN.test(digits)) return null;

  return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}

export function isValidTunisianPhone(value) {
  return Boolean(normalizeTunisianPhone(value));
}
