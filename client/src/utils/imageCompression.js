/**
 * Compression d'image côté client (FileReader + canvas) — remplace l'upload
 * disque (multer) pour les images admin (miniatures de vidéos, actualités).
 * Redimensionne à une largeur max et réexporte en JPEG compressé, encodé en
 * base64 (data:image/jpeg;base64,...), stocké directement dans le document
 * plutôt que sur le disque du serveur (qui n'est pas persistant en
 * production — cause du bug des miniatures cassées après redémarrage).
 *
 * Retourne une Promise résolue avec la chaîne base64 complète UNE FOIS toute
 * la chaîne FileReader → Image → canvas terminée — l'appelant doit await
 * avant de mettre à jour son state, pour éviter toute mise à jour partielle.
 */
export function compressImageToBase64(file, { maxWidth = 800, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Impossible de lire le fichier sélectionné."));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("Fichier image invalide ou corrompu."));

      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        // Fond blanc avant de dessiner : sans ça, les zones transparentes
        // d'un PNG/WEBP source deviennent noires une fois réexportées en
        // JPEG (qui ne supporte pas la transparence — le canvas comble avec
        // du noir par défaut).
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}
