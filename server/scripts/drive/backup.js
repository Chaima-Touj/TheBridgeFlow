/**
 * Backup de sécurité avant écriture réelle (migrate.js --confirm).
 * Exporte les documents Formation COMPLETS (pas juste weeks/supervision,
 * pour permettre une restauration totale si besoin) dans un fichier JSON
 * horodaté, local, non commité (voir .gitignore).
 *
 * Lecture seule — aucune écriture Mongo.
 *
 * Usage : node server/scripts/drive/backup.js
 * Restauration manuelle (par formation, si besoin) :
 *   voir le champ `_id` dans le backup, puis en Mongo shell / Compass :
 *   db.formations.replaceOne({ _id: ObjectId("...") }, <document du backup>)
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Formation from "../../models/formation.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "backups");

async function main() {
  console.log("Connexion à MongoDB (lecture seule)...");
  await mongoose.connect(process.env.MONGO_URI);

  const formations = await Formation.find().lean();
  console.log(`  ${formations.length} formation(s) trouvée(s).`);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `formations-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(formations, null, 2));

  const stats = fs.statSync(backupPath);
  console.log(`\n✅ Backup écrit : ${backupPath}`);
  console.log(`   ${(stats.size / 1024).toFixed(1)} Ko — ${formations.length} document(s) Formation complets (weeks, supervision, tous les autres champs).`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
