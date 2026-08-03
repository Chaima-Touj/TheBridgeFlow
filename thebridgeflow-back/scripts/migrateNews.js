// Migration ponctuelle : reprend le contenu jusqu'ici codé en dur dans
// thebridgeflow-front/src/constants/newsArticles.js (+ ses traductions FR dans
// thebridgeflow-front/src/i18n/locales/fr.json, namespace "news") vers la collection
// MongoDB News, pour ne rien perdre lors du passage au CMS admin.
// Usage : node thebridgeflow-back/scripts/migrateNews.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import News from "../models/news.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const ARTICLES = [
  {
    title: "Retrouvez-nous à Wajahni, salon d'orientation étudiante",
    excerpt: "TheBridgeFlow sera présent au salon Wajahni pour présenter ses formations et échanger avec les étudiants sur leurs projets de stage et de PFE.",
    category: "Événements",
    image: "/images/news-thumbs/wajahni-event.jpg",
    author: "admin",
    publishedAt: new Date("2026-07-08"),
  },
  {
    title: "Summer Camp 2026 : formation intensive multi-tech",
    excerpt: "Un programme intensif pour découvrir plusieurs stacks techniques (MERN, Spring/Angular, Flutter...) avec un encadrement personnalisé sur toute la durée du camp.",
    category: "Summer Camp",
    image: "/images/news-thumbs/summer-camp-2026.jpg",
    author: "admin",
    publishedAt: new Date("2026-06-20"),
  },
  {
    title: "Nos formations techniques : la liste complète",
    excerpt: "MERN, Spring/Angular, Flutter, DevOps, BI, IA, cybersécurité... découvrez l'ensemble du catalogue de formations disponibles sur la plateforme.",
    category: "Éducation",
    image: "/images/news-thumbs/stage-ete-2026.jpg",
    author: "admin",
    publishedAt: new Date("2026-05-04"),
  },
];

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connecté à MongoDB");

  for (const a of ARTICLES) {
    const exists = await News.findOne({ title: a.title });
    if (exists) {
      console.log(`⏭️  Déjà présent, ignoré : ${a.title}`);
      continue;
    }
    await News.create(a);
    console.log(`✅ Inséré : ${a.title}`);
  }

  await mongoose.disconnect();
  console.log("─────────────────────────────────────");
  console.log("Migration terminée.");
}

migrate().catch((err) => {
  console.error("❌ Erreur de migration :", err);
  process.exit(1);
});
