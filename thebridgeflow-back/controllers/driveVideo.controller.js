import asyncHandler from "../utils/asyncHandler.js";
import { ensureDriveVideoCached, isAllowedDriveVideo } from "../services/driveVideoCache.service.js";

/* ── GET /api/drive-video/:fileId ─────────────────────────────────────────────
   Public. Sert une vidéo témoignage Google Drive depuis le cache du serveur
   (téléchargée une fois depuis Drive, voir driveVideoCache.service.js).
   res.sendFile gère la lecture par morceaux (Range / 206) pour que le lecteur
   <video> démarre et avance sans télécharger tout le fichier.               */
export const getDriveVideo = asyncHandler(async (req, res, next) => {
  const { fileId } = req.params;
  if (!(await isAllowedDriveVideo(fileId))) {
    const err = new Error("Vidéo introuvable.");
    err.statusCode = 404;
    throw err;
  }

  let filePath;
  try {
    filePath = await ensureDriveVideoCached(fileId);
  } catch (error) {
    console.warn("[drive-video] Download from Google Drive failed", { fileId, message: error.message });
    const err = new Error("Vidéo momentanément indisponible.");
    err.statusCode = 502;
    throw err;
  }

  // Même correctif que /uploads et /api/drive-thumbnail : helmet() met
  // Cross-Origin-Resource-Policy: same-origin, qui bloque la vidéo quand le
  // front est sur une autre origine (dev : 5173 vs 5000).
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.sendFile(filePath, { maxAge: "1d" }, (error) => {
    // Lecteur fermé ou nouvelle requête Range pendant l'envoi : rien à signaler.
    if (error && !res.headersSent) next(error);
  });
});
