import mongoose from "mongoose";

const MAX_RETRIES  = 5;
const RETRY_DELAY  = 5000;

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
    console.error("💀 Impossible de se connecter à MongoDB. Arrêt du serveur.");
    process.exit(1);
  }
};

export default connectDB;
