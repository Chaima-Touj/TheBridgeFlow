import dotenv from "dotenv";
import mongoose from "mongoose";
import Offer from "../models/offers.model.js";

dotenv.config({ quiet: true });

const sourceUri = process.env.MONGO_URI;
const productionUri = process.env.PRODUCTION_MONGO_URI;
const applyChanges = process.argv.includes("--apply");

if (!sourceUri || !productionUri) {
  console.error("MONGO_URI (source) and PRODUCTION_MONGO_URI (target) must be configured.");
  process.exit(1);
}

if (sourceUri === productionUri) {
  console.error("Source and production URIs are identical; refusing to run.");
  process.exit(1);
}

const contentFields = [
  "title",
  "description",
  "translations",
  "companyName",
  "domain",
  "location",
  "duration",
  "type",
  "skills",
  "salary",
  "deadline",
  "isActive",
  "nbrInterns",
];

let sourceConnection;
let productionConnection;

try {
  [sourceConnection, productionConnection] = await Promise.all([
    mongoose.createConnection(sourceUri).asPromise(),
    mongoose.createConnection(productionUri).asPromise(),
  ]);

  const SourceOffer = sourceConnection.model("Offer", Offer.schema);
  const ProductionOffer = productionConnection.model("Offer", Offer.schema);
  const sourceOffers = await SourceOffer.find({}).lean();
  const sourceIds = sourceOffers.map((offer) => offer._id);
  const existingOffers = await ProductionOffer.find({ _id: { $in: sourceIds } })
    .select("_id")
    .lean();
  const existingIds = new Set(existingOffers.map((offer) => String(offer._id)));
  const insertCount = sourceOffers.filter((offer) => !existingIds.has(String(offer._id))).length;
  const updateCount = sourceOffers.length - insertCount;

  console.log(`Source offers: ${sourceOffers.length}`);
  console.log(`Production offers to update: ${updateCount}`);
  console.log(`Production offers to insert: ${insertCount}`);
  console.log(`Mode: ${applyChanges ? "APPLY" : "DRY RUN"}`);

  if (!applyChanges) {
    console.log("Run again with --apply to synchronize offer content and translations.");
  } else {
    const now = new Date();
    const operations = sourceOffers.map((offer) => {
      const content = Object.fromEntries(
        contentFields
          .filter((field) => offer[field] !== undefined)
          .map((field) => [field, offer[field]])
      );

      return {
        updateOne: {
          filter: { _id: offer._id },
          update: {
            $set: content,
            $setOnInsert: {
              createdAt: offer.createdAt || now,
              views: 0,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await ProductionOffer.bulkWrite(operations, { ordered: false });
    const activeAfterSync = await ProductionOffer.countDocuments({ isActive: true });

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Inserted: ${result.upsertedCount}`);
    console.log(`Active offers in production after sync: ${activeAfterSync}`);
  }
} finally {
  await Promise.all([
    sourceConnection?.close(),
    productionConnection?.close(),
  ]);
}
