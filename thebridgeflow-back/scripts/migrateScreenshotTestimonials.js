/**
 * Script one-off — reprend les 29 captures d'écran de témoignages, jusqu'ici
 * codées en dur dans thebridgeflow-front/src/constants/screenshotTestimonials.js
 * (FEEDBACK_IMAGE_COUNT = 29), vers la collection MongoDB TestimonialScreenshot,
 * pour les rendre gérables depuis le dashboard admin (voir AdminFeedbacks.jsx).
 *
 * Ne déplace AUCUN fichier physique : imageUrl pointe vers le chemin existant
 * (/images/feedback-thumbs/img{n}.jpg, servi tel quel par le frontend depuis
 * thebridgeflow-front/public/images/feedback-thumbs/).
 *
 * Idempotent — si des documents existent déjà (ré-exécution), ne recrée pas
 * les doublons.
 *
 * Usage : node thebridgeflow-back/scripts/migrateScreenshotTestimonials.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const connectDB               = (await import("../config/db.js")).default;
const TestimonialScreenshot   = (await import("../models/testimonialScreenshot.model.js")).default;

// Doit rester synchronisé avec FEEDBACK_IMAGE_COUNT dans
// thebridgeflow-front/src/constants/screenshotTestimonials.js.
const FEEDBACK_IMAGE_COUNT = 29;

async function main() {
  await connectDB();

  const existingCount = await TestimonialScreenshot.countDocuments();
  if (existingCount > 0) {
    console.log(`ℹ️  ${existingCount} capture(s) déjà en base. Aucune action effectuée (script idempotent).`);
    await mongoose.disconnect();
    return;
  }

  const docs = Array.from({ length: FEEDBACK_IMAGE_COUNT }, (_, i) => ({
    imageUrl: `/images/feedback-thumbs/img${i + 1}.jpg`,
    name:     "",
    order:    i + 1,
  }));

  const created = await TestimonialScreenshot.insertMany(docs);
  console.log(`✅ ${created.length} captures de témoignages importées en base.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Erreur lors de la migration des captures de témoignages :", err.message);
  process.exit(1);
});
