import api from "./api.js";

/* Envoi d'une vidéo depuis le PC de l'admin, en morceaux (voir
   thebridgeflow-back/services/mediaUpload.service.js) : chaque requête reste
   sous la limite du proxy du serveur, la progression est réelle, et une
   coupure réseau ne relance que le morceau en cours. */

export const VIDEO_UPLOAD_MAX_BYTES = 300 * 1024 * 1024;
export const VIDEO_UPLOAD_EXTENSIONS = ["mp4", "m4v", "mov", "webm"];
export const VIDEO_UPLOAD_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm";

const RETRIES_PER_CHUNK = 3;

// Contrôle avant envoi : "" si le fichier est accepté, sinon la clé de l'erreur.
export function videoFileProblem(file) {
  if (!file) return "required";
  const extension = String(file.name || "").toLowerCase().split(".").pop();
  if (!VIDEO_UPLOAD_EXTENSIONS.includes(extension)) return "type";
  if (!file.size || file.size > VIDEO_UPLOAD_MAX_BYTES) return "size";
  return "";
}

const wait = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});

/**
 * @param {File} file
 * @param {{ onProgress?: (fraction: number) => void, signal?: AbortSignal }} options
 * @returns {Promise<string>} adresse de la vidéo publiée (/uploads/testimonials/<id>.<ext>)
 */
export async function uploadVideoInChunks(file, { onProgress, signal } = {}) {
  const { data: started } = await api.post("/media-uploads", { fileName: file.name, size: file.size }, { signal });
  const chunkSize = started.chunkSize;
  let offset = 0;
  let attempts = 0;
  onProgress?.(0);

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
    try {
      const { data } = await api.put(`/media-uploads/${started.uploadId}?offset=${offset}`, chunk, {
        signal,
        headers: { "Content-Type": "application/octet-stream" },
        onUploadProgress: (event) => onProgress?.(Math.min(1, (offset + (event.loaded || 0)) / file.size)),
      });
      attempts = 0;
      offset = data.received;
      onProgress?.(offset / file.size);
      if (data.done) return data.url;
    } catch (error) {
      if (error?.name === "CanceledError" || error?.name === "AbortError" || signal?.aborted) throw error;
      // Le serveur a déjà une autre position (morceau reçu mais réponse perdue) : on reprend là.
      if (error?.response?.status === 409 && Number.isSafeInteger(error.response.data?.received)) {
        offset = error.response.data.received;
        continue;
      }
      const status = error?.response?.status;
      const retryable = !status || status >= 500 || status === 429;
      attempts += 1;
      if (!retryable || attempts > RETRIES_PER_CHUNK) throw error;
      await wait(1000 * attempts, signal);
    }
  }
  throw new Error("Upload ended without confirmation.");
}
