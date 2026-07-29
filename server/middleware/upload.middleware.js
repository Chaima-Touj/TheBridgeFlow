import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CV upload (PDF/DOC/DOCX, 5 MB) ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `cv-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [".pdf", ".doc", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Seuls les fichiers PDF, DOC et DOCX sont acceptés"));
  }
};

export const uploadCV = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("cv");

// ── Message file upload (PDF/DOC/DOCX/PNG/JPG, 10 MB) ───────────────────────
const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `msg-${unique}${ext}`);
  },
});

const messageFileFilter = (req, file, cb) => {
  const allowed = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Types acceptés : PDF, DOC, DOCX, PNG, JPG, JPEG"));
  }
};

export const uploadMessageFile = multer({
  storage: messageStorage,
  fileFilter: messageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("file");

// ── News image upload (PNG/JPG/JPEG/WEBP, 5 MB) ─────────────────────────────
const newsImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `news-${unique}${ext}`);
  },
});

const newsImageFileFilter = (req, file, cb) => {
  const allowed = [".png", ".jpg", ".jpeg", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Seuls les fichiers PNG, JPG, JPEG et WEBP sont acceptés"));
  }
};

// .single("image") n'échoue pas si aucun fichier n'est envoyé — utilisé tel
// quel en modification pour permettre de garder l'image existante.
export const uploadNewsImage = multer({
  storage: newsImageStorage,
  fileFilter: newsImageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("image");

// ── Formation video thumbnail upload (PNG/JPG/JPEG/WEBP, 5 MB) ──────────────
const videoThumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `video-thumb-${unique}${ext}`);
  },
});

const videoThumbnailFileFilter = (req, file, cb) => {
  const allowed = [".png", ".jpg", ".jpeg", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Seuls les fichiers PNG, JPG, JPEG et WEBP sont acceptés"));
  }
};

export const uploadVideoThumbnail = multer({
  storage: videoThumbnailStorage,
  fileFilter: videoThumbnailFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("thumbnail");
