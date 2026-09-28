// Importer Mongoose pour communiquer avec MongoDB

import mongoose from "mongoose";

// Définir le nombre maximum de tentatives et le délai entre les tentatives
const MAX_RETRIES  = 5;
const RETRY_DELAY  = 5000;
// Fonction pour se connecter à la base de données avec gestion des erreurs et des tentatives
const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
    });
    console.log(`✅ MongoDB connecté : ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erreur MongoDB (tentative ${attempt}/${MAX_RETRIES}) : ${error.message}`);
    if (attempt < MAX_RETRIES) {
      console.log(`⏳ Nouvelle tentative dans ${RETRY_DELAY / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return connectDB(attempt + 1);
    }
    // Si toutes les tentatives échouent, arrêter le serveur
    console.error("💀 Impossible de se connecter à MongoDB. Arrêt du serveur.");
    process.exit(1);
  }
};
// Exporter la fonction de connexion à la base de données
export default connectDB;
