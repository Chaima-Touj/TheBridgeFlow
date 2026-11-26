/* Miniature JPEG (base64) prise dans une vidéo choisie sur le PC, sans
   l'envoyer : image à ~1 s (ou au tiers d'une vidéo plus courte). Largeur
   max 540 px (cartes du carrousel ≈ 250 px, ×2 pour les écrans Retina) :
   ~40-60 Ko, car la miniature fait partie de /api/settings, chargé par
   chaque visiteur. Renvoie "" si le navigateur ne sait pas lire la vidéo
   (codec non pris en charge) : l'admin choisit alors une miniature. */
export function captureVideoPoster(file, { maxWidth = 540, quality = 0.75, atSeconds = 1, timeoutMs = 15000 } = {}) {
  if (!file || typeof document === "undefined") return Promise.resolve("");
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    const timer = setTimeout(() => finish(""), timeoutMs);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("error", () => finish(""), { once: true });
    video.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = duration > 0 ? Math.min(atSeconds, duration / 3) : 0;
    }, { once: true });
    video.addEventListener("seeked", () => {
      try {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return finish("");
        const scale = Math.min(1, maxWidth / width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", quality));
      } catch {
        finish("");
      }
    }, { once: true });
    video.src = objectUrl;
  });
}
