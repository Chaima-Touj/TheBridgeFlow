/**
 * Script one-off — backfille le champ `edition` (Number, ex. 2026) sur le
 * document CeremonySettings existant et sur tous les CeremonyProject
 * existants, avant l'entrée en service du filtrage par édition partout dans
 * ceremony.controller.js.
 *
 * Nécessaire car `default` (posé sur les deux schémas) ne s'applique qu'à
 * l'hydratation Mongoose des Documents — pas aux lectures `.lean()`, utilisées
 * partout dans ceremony.controller.js. Sans ce backfill, les documents
 * existants (déjà en base) n'auraient physiquement pas le champ `edition`, et
 * tout filtre `{ edition: currentEdition }` les exclurait silencieusement —
 * même piège déjà rencontré et documenté sur le champ CeremonyProject.status.
 *
 * SANS --confirm : dry run, affiche ce qui serait modifié. AUCUNE écriture.
 * AVEC --confirm : exécute réellement.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/backfillCeremonyEdition.js               (dry run)
 *   node thebridgeflow-back/scripts/backfillCeremonyEdition.js --confirm     (exécution réelle)
 *   node thebridgeflow-back/scripts/backfillCeremonyEdition.js --edition=2025 --confirm  (autre valeur que 2026)
 */
import "dotenv/config";
import mongoose from "mongoose";
import CeremonyProject from "../models/ceremonyProject.model.js";
import CeremonySettings from "../models/ceremonySettings.model.js";

const CONFIRM = process.argv.includes("--confirm");
const editionArg = process.argv.find((a) => a.startsWith("--edition="));
const EDITION = editionArg ? Number(editionArg.split("=")[1]) : 2026;

async function run() {
  if (!Number.isFinite(EDITION)) {
    console.error(`❌ Édition invalide : "${editionArg}".`);
    process.exitCode = 1;
    return;
  }

  // CeremonySettings — document manquant l'un OU l'autre : soit le champ
  // n'existe pas du tout (find brut, pas .lean(), donc le default 2026 du
  // schéma masquerait un doc sans le champ — on interroge donc en raw pour
  // voir la vraie valeur stockée).
  const settingsRaw = await mongoose.connection.db
    .collection("ceremonysettings")
    .findOne({});
  const settingsNeedsBackfill = settingsRaw && settingsRaw.edition === undefined;

  const projectsMissing = await CeremonyProject.countDocuments({ edition: { $exists: false } });
  const projectsTotal = await CeremonyProject.countDocuments({});

  console.log(`CeremonySettings : ${settingsRaw ? "1 document trouvé" : "aucun document (sera créé au premier appel API, rien à backfiller ici)"}${settingsRaw ? `, edition ${settingsNeedsBackfill ? "MANQUANTE" : `déjà = ${settingsRaw.edition}`}` : ""}`);
  console.log(`CeremonyProject : ${projectsMissing}/${projectsTotal} document(s) sans champ edition.`);

  if (!CONFIRM) {
    console.log(`\n👁  Dry run — rien modifié. Relance avec --confirm pour appliquer edition=${EDITION} réellement.`);
    return;
  }

  if (settingsNeedsBackfill) {
    await mongoose.connection.db
      .collection("ceremonysettings")
      .updateOne({ _id: settingsRaw._id }, { $set: { edition: EDITION } });
    console.log(`✅ CeremonySettings.edition = ${EDITION}`);
  } else {
    console.log(`↷ CeremonySettings déjà à jour, ignoré.`);
  }

  if (projectsMissing > 0) {
    const res = await CeremonyProject.updateMany(
      { edition: { $exists: false } },
      { $set: { edition: EDITION } }
    );
    console.log(`✅ ${res.modifiedCount} CeremonyProject mis à jour avec edition = ${EDITION}.`);
  } else {
    console.log(`↷ Aucun CeremonyProject à backfiller.`);
  }
}

async function main() {
  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  await run();

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
