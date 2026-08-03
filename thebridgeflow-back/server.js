import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import { verifyEmailConfig } from "./services/email.service.js";
import { mongoSanitize } from "./middleware/sanitize.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import offersRoutes from "./routes/offers.routes.js";
import applicationsRoutes from "./routes/applications.routes.js";
import messagesRoutes       from "./routes/messages.routes.js";
import conversationsRoutes  from "./routes/conversations.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import favoritesRoutes from "./routes/favorites.routes.js";
import interviewsRoutes from "./routes/interviews.routes.js";
import { notFound, errorHandler } from "./middleware/error.middleware.js";
import formationRoutes  from "./routes/formation.routes.js";
import enrollmentRoutes        from "./routes/enrollment.routes.js";
import enrollmentRequestRoutes from "./routes/enrollmentRequest.routes.js";
import adminRoutes             from "./routes/admin.routes.js";
import statsRoutes             from "./routes/stats.routes.js";
import newsRoutes              from "./routes/news.routes.js";
import trackRoutes             from "./routes/track.routes.js";
import settingsRoutes          from "./routes/settings.routes.js";
import testimonialScreenshotRoutes from "./routes/testimonialScreenshot.routes.js";
import driveProxyRoutes            from "./routes/driveProxy.routes.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Render (reverse proxy) ────────────────────────────────────────────────────
// Nécessaire pour que express-rate-limit lise correctement l'IP cliente via
// X-Forwarded-For derrière le proxy de Render, sans quoi il lève
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

// ─── Sécurité HTTP headers ────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  // Domaine Render réel du frontend déployé.
  "https://the-bridge-flow.onrender.com",
  // Anciens noms du service Render — à retirer une fois confirmé que plus rien
  // n'en dépend côté prod.
  "https://the-bridge-flow-app.onrender.com",
  "https://stage-flow-app.onrender.com",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: "Trop de tentatives, réessayez dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== "production",
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Parsers ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Protection NoSQL injection (compatible Express 5) ────────────────────────
app.use(mongoSanitize);

// ─── Uploads statiques ───────────────────────────────────────────────────────
// helmet() applique par défaut Cross-Origin-Resource-Policy: same-origin, ce
// qui bloque silencieusement (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin) tout
// <img src> chargé depuis le frontend (autre origine en dev : 5173 vs 5000).
// Un <a href> de téléchargement direct n'est pas concerné (navigation, pas
// sous-ressource) — d'où le bug resté invisible jusqu'à l'ajout d'images
// news affichées en <img>. On ré-ouvre CORP uniquement sur /uploads.
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  },
}));

app.get("/", (req, res) => {
  res.json({ message: "🚀 TheBridgeFlow API is running!" });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",          authLimiter, authRoutes);
app.use("/api/offers",        apiLimiter,  offersRoutes);
app.use("/api/applications",  apiLimiter,  applicationsRoutes);
app.use("/api/messages",       apiLimiter,  messagesRoutes);
app.use("/api/conversations",  apiLimiter,  conversationsRoutes);
app.use("/api/notifications", apiLimiter,  notificationsRoutes);
app.use("/api/ai",            apiLimiter,  aiRoutes);
app.use("/api/favorites",     apiLimiter,  favoritesRoutes);
app.use("/api/interviews",    apiLimiter,  interviewsRoutes);
app.use("/api/formations",  apiLimiter, formationRoutes);
app.use("/api/enrollments",         apiLimiter, enrollmentRoutes);
app.use("/api/enrollment-requests", apiLimiter, enrollmentRequestRoutes);
app.use("/api/admin",               apiLimiter, adminRoutes);
app.use("/api/stats",               apiLimiter, statsRoutes);
app.use("/api/news",                apiLimiter, newsRoutes);
app.use("/api/track",               apiLimiter, trackRoutes);
app.use("/api/settings",            apiLimiter, settingsRoutes);
app.use("/api/testimonial-screenshots", apiLimiter, testimonialScreenshotRoutes);
app.use("/api/drive-thumbnail",     apiLimiter, driveProxyRoutes);


// ─── Gestion des erreurs ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Rejets non catchés ───────────────────────────────────────────────────────
process.on("unhandledRejection", (err) => {
  console.error("❌ UnhandledRejection:", err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("─────────────────────────────────────");
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}`);
    console.log("─────────────────────────────────────");
  });

  // Diagnostic de la configuration email (API Brevo) au démarrage — ne bloque pas
  // le démarrage du serveur si ça échoue.
  verifyEmailConfig();
});
