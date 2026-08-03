/**
 * Script one-off — crée le premier compte admin en base.
 * Usage : node thebridgeflow-back/scripts/createAdmin.js
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

const ADMIN_EMAIL    = "admin@thebridgeflow.local";
const ADMIN_PASSWORD = "Admin123!"; // hashé par le hook pre("save") du modèle User, comme pour tout autre compte

async function main() {
  await connectDB();

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log(`ℹ️  Un utilisateur existe déjà pour ${ADMIN_EMAIL} (role: ${existing.role}). Aucune action effectuée.`);
    await mongoose.disconnect();
    return;
  }

  // La création via User.create() déclenche le hook pre("save") du modèle,
  // qui hashe le mot de passe exactement comme pour une inscription classique.
  const admin = await User.create({
    name:       "Admin",
    email:      ADMIN_EMAIL,
    password:   ADMIN_PASSWORD,
    role:       "admin",
    isActive:   true,
    isVerified: true, // pas de flux de vérification email pour un compte créé directement en base
  });

  console.log(`✅ Compte admin créé : ${admin.email} (_id: ${admin._id})`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Erreur lors de la création du compte admin :", err.message);
  process.exit(1);
});
