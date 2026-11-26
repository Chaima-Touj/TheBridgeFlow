/* Vidéos de témoignages envoyées depuis le PC de l'admin (page Feedbacks).

   Envoi en morceaux de 8 Mo (PUT successifs) : chaque requête reste sous la
   limite de taille du proxy du serveur, et une coupure réseau ne fait perdre
   que le morceau en cours (reprise à partir de l'octet déjà reçu).

   Sans état en mémoire : le fichier temporaire porte lui-même son extension
   et sa taille finale (tmp-uploads/<id>.<ext>.<taille>.part). Une fois
   complet et vérifié (signature MP4/MOV/WebM), il devient
   uploads/testimonials/<id>.<ext>, servi tel quel par express.static
   (/uploads, lecture partielle « Range » comprise). Les fichiers qu'aucun
   témoignage n'utilise (envoi abandonné, vidéo remplacée) sont supprimés par
   cleanupOrphans. */
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
export const CHUNK_BYTES = 8 * 1024 * 1024;
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm"];
export const PUBLIC_VIDEO_PREFIX = "/uploads/testimonials/";

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STORED_VIDEO = new RegExp(`^${PUBLIC_VIDEO_PREFIX.replace(/\//g, "\\/")}([0-9a-f-]{36})\\.(${VIDEO_EXTENSIONS.join("|")})$`);
const PART_FILE = /^([0-9a-f-]{36})\.([a-z0-9]+)\.(\d+)\.part$/;
// Envoi commencé puis abandonné : fichier temporaire supprimé après 24 h.
const PART_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Vidéo envoyée mais jamais enregistrée (formulaire annulé) : supprimée après 6 h.
const ORPHAN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const httpError = (statusCode, message, extra = {}) => Object.assign(new Error(message), { statusCode, ...extra });

const extensionOf = (fileName) => String(fileName ?? "").trim().toLowerCase().split(".").pop();

// Signature des premiers octets : conteneur ISO (MP4/M4V/MOV, boîte « ftyp »
// ou anciens fichiers QuickTime) ou EBML (WebM).
export function looksLikeVideo(header, extension) {
  if (!Buffer.isBuffer(header) || header.length < 12) return false;
  if (extension === "webm") return header.readUInt32BE(0) === 0x1a45dfa3;
  const box = header.toString("latin1", 4, 8);
  return ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box);
}

export function createMediaStore({ root = process.env.MEDIA_UPLOADS_ROOT || path.join(__dirname, "..", "uploads"), now = () => Date.now() } = {}) {
  const partsDir = path.join(root, "tmp-uploads");
  const videosDir = path.join(root, "testimonials");
  // Un seul PUT à la fois par envoi : deux morceaux concurrents se marcheraient dessus.
  const busy = new Set();

  async function findPart(uploadId) {
    if (!UPLOAD_ID.test(String(uploadId))) throw httpError(400, "Identifiant d'envoi invalide.");
    const names = await fsp.readdir(partsDir).catch(() => []);
    const name = names.find((entry) => entry.startsWith(`${uploadId}.`) && entry.endsWith(".part"));
    const match = name && PART_FILE.exec(name);
    if (!match) throw httpError(404, "Envoi introuvable ou expiré : recommencez l'envoi de la vidéo.");
    return { file: path.join(partsDir, name), extension: match[2], total: Number(match[3]) };
  }

  /* Début d'un envoi : vérifie le format (extension) et la taille annoncée. */
  async function start({ fileName, size } = {}) {
    const extension = extensionOf(fileName);
    if (!VIDEO_EXTENSIONS.includes(extension)) throw httpError(400, "Format non pris en charge : MP4, WebM ou MOV.");
    const total = Number(size);
    if (!Number.isSafeInteger(total) || total <= 0) throw httpError(400, "Taille de fichier invalide.");
    if (total > MAX_VIDEO_BYTES) throw httpError(413, "La vidéo dépasse 300 Mo.");
    await fsp.mkdir(partsDir, { recursive: true });
    const uploadId = crypto.randomUUID();
    await fsp.writeFile(path.join(partsDir, `${uploadId}.${extension}.${total}.part`), Buffer.alloc(0), { flag: "wx" });
    return { uploadId, chunkSize: CHUNK_BYTES, maxBytes: MAX_VIDEO_BYTES };
  }

  /* Ajoute un morceau à partir de `offset`. Un décalage différent de la
     taille déjà reçue renvoie 409 avec `received` (reprise côté client). Le
     dernier morceau vérifie la signature puis publie la vidéo. */
  // Dernier morceau déjà reçu et vidéo publiée, mais réponse perdue (réseau) :
  // le client renvoie ce morceau → on confirme au lieu de répondre « introuvable ».
  async function alreadyPublished(uploadId, offset, chunk) {
    for (const extension of VIDEO_EXTENSIONS) {
      const fileName = `${uploadId}.${extension}`;
      const stats = await fsp.stat(path.join(videosDir, fileName)).catch(() => null);
      if (stats?.isFile() && Number(offset) + (chunk?.length || 0) === stats.size) {
        return { done: true, received: stats.size, url: `${PUBLIC_VIDEO_PREFIX}${fileName}` };
      }
    }
    return null;
  }

  async function appendChunk(uploadId, offset, chunk) {
    let part;
    try {
      part = await findPart(uploadId);
    } catch (error) {
      const published = error.statusCode === 404 ? await alreadyPublished(uploadId, offset, chunk) : null;
      if (published) return published;
      throw error;
    }
    const { file, extension, total } = part;
    if (!Buffer.isBuffer(chunk) || chunk.length === 0) throw httpError(400, "Morceau de fichier vide.");
    if (chunk.length > CHUNK_BYTES) throw httpError(413, "Morceau de fichier trop grand.");
    if (busy.has(uploadId)) throw httpError(409, "Un autre morceau de cette vidéo est en cours d'envoi.");
    busy.add(uploadId);
    try {
      const received = (await fsp.stat(file)).size;
      if (Number(offset) !== received) throw httpError(409, "Position d'envoi inattendue.", { received });
      if (received + chunk.length > total) throw httpError(400, "Le fichier reçu dépasse la taille annoncée.");
      await fsp.appendFile(file, chunk);
      const size = received + chunk.length;
      if (size < total) return { done: false, received: size };

      const header = Buffer.alloc(16);
      const handle = await fsp.open(file, "r");
      try { await handle.read(header, 0, 16, 0); } finally { await handle.close(); }
      if (!looksLikeVideo(header, extension)) {
        await fsp.rm(file, { force: true });
        throw httpError(400, "Le fichier n'est pas une vidéo valide (MP4, WebM ou MOV).");
      }
      await fsp.mkdir(videosDir, { recursive: true });
      const fileName = `${uploadId}.${extension}`;
      await fsp.rename(file, path.join(videosDir, fileName));
      return { done: true, received: size, url: `${PUBLIC_VIDEO_PREFIX}${fileName}` };
    } finally {
      busy.delete(uploadId);
    }
  }

  // Chemin disque d'une vidéo publiée (/uploads/testimonials/<id>.<ext>), ou null.
  function storedVideoPath(url) {
    const match = STORED_VIDEO.exec(String(url ?? ""));
    return match ? path.join(videosDir, `${match[1]}.${match[2]}`) : null;
  }

  async function storedVideoExists(url) {
    const file = storedVideoPath(url);
    if (!file) return false;
    return fsp.stat(file).then((stats) => stats.isFile(), () => false);
  }

  async function removeStoredVideo(url) {
    const file = storedVideoPath(url);
    if (file) await fsp.rm(file, { force: true });
  }

  /* Supprime les vidéos qu'aucune URL de `referencedUrls` n'utilise (plus
     vieilles que 6 h : un envoi tout juste terminé attend encore l'appui sur
     « Enregistrer ») et les envois inachevés de plus de 24 h. */
  async function cleanupOrphans(referencedUrls = [], { orphanMaxAgeMs = ORPHAN_MAX_AGE_MS, partMaxAgeMs = PART_MAX_AGE_MS } = {}) {
    const referenced = new Set([...referencedUrls].filter(Boolean).map(String));
    const removed = { videos: 0, parts: 0 };
    const sweep = async (dir, shouldRemove, counter) => {
      for (const name of await fsp.readdir(dir).catch(() => [])) {
        const file = path.join(dir, name);
        const stats = await fsp.stat(file).catch(() => null);
        if (!stats?.isFile() || !(await shouldRemove(name, stats))) continue;
        await fsp.rm(file, { force: true });
        removed[counter] += 1;
      }
    };
    await sweep(videosDir, (name, stats) => !referenced.has(`${PUBLIC_VIDEO_PREFIX}${name}`) && now() - stats.mtimeMs > orphanMaxAgeMs, "videos");
    await sweep(partsDir, (name, stats) => name.endsWith(".part") && now() - stats.mtimeMs > partMaxAgeMs, "parts");
    return removed;
  }

  return { root, partsDir, videosDir, start, appendChunk, storedVideoPath, storedVideoExists, removeStoredVideo, cleanupOrphans };
}

export const mediaStore = createMediaStore();
