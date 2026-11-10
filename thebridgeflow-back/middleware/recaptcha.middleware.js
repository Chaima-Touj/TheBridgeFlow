const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MINIMUM_SCORE = 0.5;
let missingSecretWarningShown = false;

function getAllowedHostnames() {
  return (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
}

// Deux types de clés Google reCAPTCHA sont acceptés :
// - v2 « Je ne suis pas un robot » (case visible) : RECAPTCHA_V2_SECRET_KEY,
//   le front envoie alors l'en-tête X-Recaptcha-Version: v2 ;
// - v3 invisible (score) : RECAPTCHA_SECRET_KEY.
// Tant qu'aucune des deux clés n'est configurée, la vérification est désactivée.
// Dès qu'une clé existe, toute requête sans jeton valide est refusée.
export async function verifyRecaptcha(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/track/")) {
    return next();
  }

  const v3Secret = process.env.RECAPTCHA_SECRET_KEY;
  const v2Secret = process.env.RECAPTCHA_V2_SECRET_KEY;
  if (!v3Secret && !v2Secret) {
    if (!missingSecretWarningShown) {
      console.warn("[recaptcha] RECAPTCHA_SECRET_KEY and RECAPTCHA_V2_SECRET_KEY are missing; anti-bot verification is disabled.");
      missingSecretWarningShown = true;
    }
    return next();
  }

  const token = req.get("x-recaptcha-token");
  if (!token) {
    return res.status(403).json({ message: "Veuillez valider la vérification anti-robot avant de continuer." });
  }

  const isV2 = String(req.get("x-recaptcha-version") || "").toLowerCase() === "v2";
  if (!isV2 && !v3Secret) {
    // Seule la case v2 est configurée : un jeton v3 (ou sans version) n'est jamais accepté.
    return res.status(403).json({ message: "Veuillez valider la vérification anti-robot avant de continuer." });
  }

  const configuredHostnames = getAllowedHostnames();
  const minimumScore = Number(process.env.RECAPTCHA_MINIMUM_SCORE || DEFAULT_MINIMUM_SCORE);
  if ((isV2 && !v2Secret)
    || (process.env.NODE_ENV === "production" && configuredHostnames.length === 0)
    || (!isV2 && (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 1))) {
    console.error("[recaptcha] Invalid server configuration.", { version: isV2 ? "v2" : "v3" });
    return res.status(503).json({ message: "La vérification anti-robot n'est pas correctement configurée sur le serveur." });
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: isV2 ? v2Secret : v3Secret, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Google reCAPTCHA verification returned HTTP ${response.status}.`);
    const result = await response.json();
    const hostnameAllowed = configuredHostnames.length === 0
      || configuredHostnames.includes(String(result.hostname || "").toLowerCase());
    // v2 : la case a été cochée (pas de score). v3 : score suffisant pour l'action "submit".
    const valid = isV2
      ? result.success === true && hostnameAllowed
      : result.success === true
        && result.action === "submit"
        && Number.isFinite(result.score)
        && result.score >= minimumScore
        && hostnameAllowed;
    if (!valid) {
      return res.status(403).json({ message: "La vérification anti-robot a échoué. Veuillez réessayer." });
    }
    return next();
  } catch (error) {
    console.error("[recaptcha] Verification service unavailable", { message: error.message });
    return res.status(503).json({ message: "La vérification anti-robot est momentanément indisponible. Réessayez." });
  }
}
