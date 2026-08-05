/**
 * Script one-off — vide trailerVideoUrl/trailerThumbnail/trailerDriveUrl sur
 * toutes les formations.
 *
 * Ces champs existent dans le schéma depuis longtemps (Formation.trailer*)
 * mais n'ont jamais été exposés côté UI (ni admin, ni page publique) — leurs
 * valeurs actuelles sont soit un placeholder de test ("...watch?v=dQw4w9WgXcQ"
 * sur 7 formations sur 9), soit un ancien chemin local pré-migration Drive
 * jamais nettoyé ("ai", "mern-stack"). Avant de câbler l'affichage public
 * (section "Vidéo résumé", masquée quand trailerVideoUrl est vide), on vide
 * ces valeurs pour repartir d'un état propre — un admin renseignera une
 * vraie vidéo via le nouveau formulaire quand il le souhaite.
 *
 * SANS --confirm : dry run, affiche ce qui serait modifié. AUCUNE écriture.
 * AVEC --confirm : exécute réellement.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/clearFormationTrailerPlaceholders.js            (dry run)
 *   node thebridgeflow-back/scripts/clearFormationTrailerPlaceholders.js --confirm  (écriture réelle)
 */
import "dotenv/config";
import mongoose from "mongoose";
import Formation from "../models/formation.model.js";

const CONFIRM = process.argv.includes("--confirm");

async function main() {
  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  const formations = await Formation.find().select("title slug trailerVideoUrl trailerThumbnail trailerDriveUrl");
  console.log(`${formations.length} formation(s) trouvée(s).\n`);

  let cleared = 0;
  for (const f of formations) {
    const hasSomething = f.trailerVideoUrl || f.trailerThumbnail || f.trailerDriveUrl;
    if (!hasSomething) {
      console.log(`  - ${f.slug} : déjà vide, rien à faire.`);
      continue;
    }

    cleared++;
    console.log(
      `  - ${f.slug} : trailerVideoUrl="${f.trailerVideoUrl}" trailerThumbnail="${f.trailerThumbnail}" ` +
      `trailerDriveUrl="${f.trailerDriveUrl}" ${CONFIRM ? "→ vidé" : "→ serait vidé"}`
    );

    if (CONFIRM) {
      f.trailerVideoUrl = "";
      f.trailerThumbnail = "";
      f.trailerDriveUrl = "";
      await f.save();
    }
  }

  console.log(
    CONFIRM
      ? `\n✅ ${cleared} formation(s) nettoyée(s).`
      : `\n👁  Dry run — ${cleared} formation(s) seraient nettoyées. Relance avec --confirm pour écrire réellement.`
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
