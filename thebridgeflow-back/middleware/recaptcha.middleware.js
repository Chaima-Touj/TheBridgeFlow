const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
let missingSecretWarningShown = false;

function getAllowedHostnames() {
  return (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
}

// reCAPTCHA v2 « Je ne suis pas un robot » (case visible) : RECAPTCHA_V2_SECRET_KEY.
// Le front envoie le jeton de la case dans l'en-tête X-Recaptcha-Token.
// L'ancienne clé v3 invisible (RECAPTCHA_SECRET_KEY) n'est plus utilisée : ses
// jetons étaient refusés pour de vrais étudiants et bloquaient la connexion.
// Tant que RECAPTCHA_V2_SECRET_KEY n'est pas configurée, la vérification est désactivée.
// Dès qu'elle existe, toute requête sans case cochée valide est refusée.
export async function verifyRecaptcha(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/track/")) {
    return next();
  }

  const secret = process.env.RECAPTCHA_V2_SECRET_KEY;
  if (!secret) {
    if (!missingSecretWarningShown) {
      console.warn("[recaptcha] RECAPTCHA_V2_SECRET_KEY is missing; anti-bot verification is disabled.");
      missingSecretWarningShown = true;
    }
    return next();
  }

  const token = req.get("x-recaptcha-token");
  if (!token) {
    return res.status(403).json({ message: "Veuillez cocher la case « Je ne suis pas un robot » avant de continuer." });
  }

  const configuredHostnames = getAllowedHostnames();
  if (process.env.NODE_ENV === "production" && configuredHostnames.length === 0) {
    console.error("[recaptcha] Invalid server configuration: RECAPTCHA_ALLOWED_HOSTNAMES is empty.");
    return res.status(503).json({ message: "La vérification anti-robot n'est pas correctement configurée sur le serveur." });
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Google reCAPTCHA verification returned HTTP ${response.status}.`);
    const result = await response.json();
    const hostname = String(result.hostname || "").toLowerCase();
    const hostnameAllowed = configuredHostnames.length === 0 || configuredHostnames.includes(hostname);
    if (result.success !== true || !hostnameAllowed) {
      // Raison du refus dans les logs (sans le jeton ni la clé) pour diagnostiquer.
      console.warn("[recaptcha] Verification refused", {
        path: req.originalUrl,
        success: result.success,
        hostname,
        hostnameAllowed,
        errorCodes: result["error-codes"],
      });
      return res.status(403).json({ message: "La vérification anti-robot a échoué. Cochez à nouveau la case et réessayez." });
    }
    return next();
  } catch (error) {
    console.error("[recaptcha] Verification service unavailable", { message: error.message });
    return res.status(503).json({ message: "La vérification anti-robot est momentanément indisponible. Réessayez." });
  }
}
