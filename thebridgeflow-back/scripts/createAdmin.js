/**
 * Script one-off — crée le premier compte admin en base, en attente de
 * vérification email.
 * Usage : node thebridgeflow-back/scripts/createAdmin.js
 * Requiert ADMIN_EMAIL et ADMIN_PASSWORD dans thebridgeflow-back/.env.
 *
 * Ne pas appeler depuis server.js — script à lancer manuellement une seule fois.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const connectDB = (await import("../config/db.js")).default;
const User      = (await import("../models/users.model.js")).default;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans thebridgeflow-back/.env.");
  }
  if (ADMIN_PASSWORD.length < 8) {
    throw new Error("ADMIN_PASSWORD doit contenir au moins 8 caractères.");
  }

  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`ℹ️  Un utilisateur existe déjà pour ${ADMIN_EMAIL} (role: ${existing.role}). Aucune action effectuée.`);
    await mongoose.disconnect();
    return;
  }

  const verificationCode = String((await import("node:crypto")).randomInt(100000, 1000000));
  const admin = await User.create({
    name:       "Admin",
    email:      ADMIN_EMAIL,
    password:   ADMIN_PASSWORD,
    role:       "admin",
    isActive:   false,
    isVerified: false,
    verifyCode: verificationCode,
    verifyCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
  });

  const emailService = (await import("../services/email.service.js")).default;
  const result = await emailService.sendVerifyCode(admin.email, { name: admin.name, code: verificationCode });
  console.log(`✅ Compte admin créé en attente de vérification : ${admin.email} (_id: ${admin._id})`);
  if (!result.success) console.error(`⚠️  Email de vérification non envoyé : ${result.error}. Connectez-vous pour demander un nouveau code.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Erreur lors de la création du compte admin :", err.message);
  process.exit(1);
});
