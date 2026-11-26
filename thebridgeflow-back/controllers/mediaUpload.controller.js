import asyncHandler from "../utils/asyncHandler.js";
import { mediaStore } from "../services/mediaUpload.service.js";

/* ── POST /api/media-uploads ──────────────────────────────────────────────────
   Réservé admin. Début de l'envoi d'une vidéo depuis le PC :
   { fileName, size } → { uploadId, chunkSize, maxBytes }. */
export const startMediaUpload = asyncHandler(async (req, res) => {
  const { fileName, size } = req.body || {};
  res.status(201).json(await mediaStore.start({ fileName, size }));
});

/* ── PUT /api/media-uploads/:uploadId?offset=N ───────────────────────────────
   Réservé admin. Corps brut (application/octet-stream) = un morceau de la
   vidéo à partir de l'octet N. Réponse : { done, received } puis, au dernier
   morceau, { done: true, url: "/uploads/testimonials/<id>.<ext>" }. Une
   position inattendue répond 409 avec `received` pour reprendre l'envoi. */
export const appendMediaChunk = asyncHandler(async (req, res) => {
  const offset = Number(req.query.offset);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    const error = new Error("Position d'envoi invalide.");
    error.statusCode = 400;
    throw error;
  }
  try {
    res.json(await mediaStore.appendChunk(req.params.uploadId, offset, req.body));
  } catch (error) {
    if (error.statusCode === 409 && error.received !== undefined) {
      res.status(409).json({ message: error.message, received: error.received });
      return;
    }
    throw error;
  }
});
