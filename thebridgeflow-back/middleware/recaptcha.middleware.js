const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MINIMUM_SCORE = 0.5;
let developmentWarningShown = false;

export async function verifyRecaptcha(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/track/")) {
    return next();
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ message: "La vérification anti-robot n'est pas configurée sur le serveur." });
    }
    if (!developmentWarningShown) {
      console.warn("[recaptcha] RECAPTCHA_SECRET_KEY is missing; anti-bot verification is bypassed outside production.");
      developmentWarningShown = true;
    }
    return next();
  }

  const token = req.get("x-recaptcha-token");
  if (!token) {
    return res.status(403).json({ message: "Veuillez valider la vérification anti-robot avant de continuer." });
  }

  const configuredHostnames = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  const minimumScore = Number(process.env.RECAPTCHA_MINIMUM_SCORE || DEFAULT_MINIMUM_SCORE);
  if ((process.env.NODE_ENV === "production" && configuredHostnames.length === 0)
    || !Number.isFinite(minimumScore)
    || minimumScore < 0
    || minimumScore > 1) {
    console.error("[recaptcha] Invalid server configuration.");
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
    if (result.success !== true
      || result.action !== "submit"
      || !Number.isFinite(result.score)
      || result.score < minimumScore
      || (configuredHostnames.length > 0 && !configuredHostnames.includes(String(result.hostname || "").toLowerCase()))) {
      return res.status(403).json({ message: "La vérification anti-robot a échoué. Veuillez réessayer." });
    }
    return next();
  } catch (error) {
    console.error("[recaptcha] Verification service unavailable", { message: error.message });
    return res.status(503).json({ message: "La vérification anti-robot est momentanément indisponible. Réessayez." });
  }
}
