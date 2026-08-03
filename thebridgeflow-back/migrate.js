import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ Connecté à MongoDB");

const db = mongoose.connection.db;
const collection = db.collection("offers");

const offers = await collection.find({}).toArray();
console.log(`📦 ${offers.length} offres trouvées`);

let updated = 0;
let skipped = 0;

const normalizeType = (t) => {
  if (!t) return "stage";
  const v = String(t).toLowerCase().trim();
  if (v === "stage pfe" || v === "pfe") return "PFE";
  if (v === "alternance") return "alternance";
  return "stage";
};

for (const offer of offers) {
  const updates = {};

  // company → companyName
  if (!offer.companyName && offer.company) {
    updates.companyName = offer.company;
  }

  // desc → description
  if (!offer.description && offer.desc) {
    updates.description = offer.desc;
  }

  // skillsRequired ou motsCles → skills
  if ((!offer.skills || offer.skills.length === 0)) {
    if (offer.skillsRequired?.length) {
      updates.skills = offer.skillsRequired;
    } else if (offer.motsCles?.length) {
      updates.skills = offer.motsCles;
    }
  }

  // specialite → domain
  if (!offer.domain && offer.specialite) {
    updates.domain = offer.specialite;
  }

  // Normaliser le type
  const normalizedType = normalizeType(offer.type);
  if (offer.type !== normalizedType) {
    updates.type = normalizedType;
  }

  // isActive par défaut si absent
  if (offer.isActive === undefined || offer.isActive === null) {
    updates.isActive = true;
  }

  if (Object.keys(updates).length > 0) {
    await collection.updateOne(
      { _id: offer._id },
      { $set: updates }
    );
    updated++;
    console.log(`  ✓ Migré: ${offer.title?.slice(0, 50)}`);
  } else {
    skipped++;
  }
}

console.log(`\n✅ Migration terminée — ${updated} offres mises à jour, ${skipped} déjà conformes`);
process.exit(0);
