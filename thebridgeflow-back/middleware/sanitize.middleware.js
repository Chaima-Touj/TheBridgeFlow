/**
 * Middleware de protection contre les injections NoSQL
 * Compatible Express 5 (req.query est en lecture seule)
 * Supprime les clés commençant par $ ou contenant des points
 * dans req.body et req.params uniquement
 */

const sanitizeValue = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeValue);

  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !key.startsWith("$") && !key.includes("."))
      .map(([key, val]) => [key, sanitizeValue(val)])
  );
};

export const mongoSanitize = (req, res, next) => {
  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
