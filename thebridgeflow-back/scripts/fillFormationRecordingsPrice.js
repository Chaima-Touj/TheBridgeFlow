/**
 * Script one-off — renseigne price.recordings sur les 9 formations
 * existantes avec "150 DT/Mois" (même format que price.onsite/price.online),
 * cohérent avec le tarif déjà annoncé statiquement sur PricingPage.jsx
 * (PLAN_KEYS "recordings" = "150").
 *
 * Le champ price.recordings a été ajouté au schéma récemment (optionnel,
 * default: "") — toutes les formations existantes l'ont donc vide. Ce
 * script les backfill une seule fois avec la valeur de lancement commune ;
 * un admin pourra ensuite ajuster individuellement depuis AdminFormations.
 *
 * Update ciblé : seul price.recordings est modifié (onsite/online/level/
 * duration/etc. non touchés) — .save() sur un document Mongoose n'envoie
 * que les chemins modifiés, pas le document entier.
 *
 * SANS --confirm : dry run, affiche ce qui serait modifié. AUCUNE écriture.
 * AVEC --confirm : exécute réellement.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/fillFormationRecordingsPrice.js            (dry run)
 *   node thebridgeflow-back/scripts/fillFormationRecordingsPrice.js --confirm  (écriture réelle)
 */
import "dotenv/config";
import mongoose from "mongoose";
import Formation from "../models/formation.model.js";

const CONFIRM = process.argv.includes("--confirm");
const TARGET_VALUE = "150 DT/Mois";

async function main() {
  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  const formations = await Formation.find().select("title slug price");
  console.log(`${formations.length} formation(s) trouvée(s).\n`);

  let updated = 0;
  for (const f of formations) {
    const current = f.price?.recordings || "";
    if (current === TARGET_VALUE) {
      console.log(`  - ${f.slug} : déjà "${TARGET_VALUE}", rien à faire.`);
      continue;
    }

    updated++;
    console.log(
      `  - ${f.slug} : recordings actuel="${current}" (onsite="${f.price?.onsite}", online="${f.price?.online}") ` +
      `${CONFIRM ? "→ mis à jour vers" : "→ serait mis à jour vers"} "${TARGET_VALUE}"`
    );

    if (CONFIRM) {
      f.price.recordings = TARGET_VALUE;
      await f.save();
    }
  }

  console.log(
    CONFIRM
      ? `\n✅ ${updated} formation(s) mise(s) à jour.`
      : `\n👁  Dry run — ${updated} formation(s) seraient mises à jour. Relance avec --confirm pour écrire réellement.`
  );

  if (CONFIRM) {
    console.log("\nVérification post-écriture :");
    const after = await Formation.find().select("title slug price").lean();
    for (const f of after) {
      const ok = f.price?.recordings === TARGET_VALUE;
      console.log(
        `  - ${f.slug} : recordings="${f.price?.recordings}" ${ok ? "✅" : "❌"} | onsite="${f.price?.onsite}" online="${f.price?.online}"`
      );
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
