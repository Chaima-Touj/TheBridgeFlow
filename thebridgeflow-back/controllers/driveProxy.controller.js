import asyncHandler from "../utils/asyncHandler.js";

// Format d'ID de fichier Google Drive réel (alphanumérique + - et _) — rejette
// toute autre valeur avant de construire l'URL sortante.
const DRIVE_FILE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

/* ── GET /api/drive-thumbnail/:fileId ─────────────────────────────────────────
   Public. Proxy pour la vignette d'un fichier Google Drive (image ou vidéo).

   Pourquoi : drive.google.com/thumbnail?id=... répond correctement en
   navigation directe ou en requête serveur-à-serveur (redirection 302 vers
   lh3.googleusercontent.com suivie normalement), mais le navigateur refuse de
   suivre cette redirection quand la requête vient d'une <img> intégrée
   cross-site (restriction anti-hotlinking côté Google, détectée via les
   en-têtes Sec-Fetch-* — vérifié : la vignette reste noire sur le carousel
   même si l'URL fonctionne testée isolément). On récupère l'image ici, côté
   serveur (pas de restriction cross-site pour une requête serveur-à-serveur),
   et on la reesert depuis notre propre origine — l'<img> du frontend pointe
   alors sur cette route plutôt que directement sur drive.google.com.        */
export const getDriveThumbnail = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  if (!DRIVE_FILE_ID_REGEX.test(fileId)) {
    const err = new Error("Identifiant de fichier Google Drive invalide.");
    err.statusCode = 400;
    throw err;
  }

  const driveRes = await fetch(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!driveRes.ok) {
    const err = new Error("Vignette introuvable pour ce fichier.");
    err.statusCode = 404;
    throw err;
  }

  const buffer = Buffer.from(await driveRes.arrayBuffer());
  res.setHeader("Content-Type", driveRes.headers.get("content-type") || "image/jpeg");
  // Vignette stable pour un même fileId — mise en cache 24h côté navigateur/CDN.
  res.setHeader("Cache-Control", "public, max-age=86400");
  // helmet() applique par défaut Cross-Origin-Resource-Policy: same-origin, ce
  // qui bloque silencieusement (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin) tout
  // <img src> chargé depuis le frontend (autre origine en dev : 5173 vs 5000)
  // — même correctif déjà appliqué à /uploads dans server.js.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(buffer);
});
