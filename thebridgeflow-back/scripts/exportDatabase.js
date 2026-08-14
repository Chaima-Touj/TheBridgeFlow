/**
 * Export complet de la base MongoDB en un unique fichier JSON, pour
 * transmission à l'encadrant (voir investigation précédente : 19
 * collections, ~495 Ko, dont 3 orphelines sans modèle Mongoose —
 * candidatures/demandes/supervision — d'où l'usage du driver MongoDB natif
 * plutôt que les modèles, pour être sûr de toutes les couvrir).
 *
 * LECTURE SEULE — aucune écriture sur MongoDB. Écrit uniquement un fichier
 * local hors du repo (~/Downloads/), jamais dans le projet, pour éviter
 * tout risque de commit accidentel de données réelles (utilisateurs,
 * candidatures...).
 *
 * Rédaction : dans la collection "users" uniquement, les 7 champs
 * sensibles identifiés (tous select:false côté Mongoose donc invisibles
 * pour l'app, mais présents tels quels dans les documents bruts — un dump
 * driver natif contourne select:false) sont remplacés par "[REDACTED]"
 * (clé conservée, valeur masquée) :
 *   password, resetPasswordToken, resetPasswordExpires,
 *   verifyCode, verifyCodeExpires, googleId, facebookId
 *
 * Usage : node thebridgeflow-back/scripts/exportDatabase.js
 */
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";

const OUTPUT_DIR = path.join(os.homedir(), "Downloads");

const REDACTED_USER_FIELDS = [
  "password",
  "resetPasswordToken",
  "resetPasswordExpires",
  "verifyCode",
  "verifyCodeExpires",
  "googleId",
  "facebookId",
];

function redactUserDoc(doc) {
  const redacted = { ...doc };
  for (const field of REDACTED_USER_FIELDS) {
    if (field in redacted) redacted[field] = "[REDACTED]";
  }
  return redacted;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-JJ
}

async function main() {
  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log(`${collections.length} collection(s) trouvée(s) dans la base "${db.databaseName}".\n`);

  const exportData = {};
  const summary = [];

  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const docs = await db.collection(name).find({}).toArray();
    exportData[name] = name === "users" ? docs.map(redactUserDoc) : docs;
    summary.push({ name, count: docs.length });
    console.log(`  ${name.padEnd(28)} ${String(docs.length).padStart(6)} document(s)`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `thebridgeflow-db-export-${todayStamp()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

  const stats = fs.statSync(outputPath);
  const totalDocs = summary.reduce((sum, s) => sum + s.count, 0);

  console.log("");
  console.log(`✅ Export écrit : ${outputPath}`);
  console.log(`   ${(stats.size / 1024).toFixed(1)} Ko — ${totalDocs} document(s) au total sur ${collections.length} collection(s).`);
  console.log(`   Collection "users" : champs [${REDACTED_USER_FIELDS.join(", ")}] remplacés par "[REDACTED]".`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
