import mongoose from "mongoose";
import EventParticipationRequest from "../models/eventParticipationRequest.model.js";

/* Reprise des anciens « Messages du site » (collection contactsubmissions,
   formulaire de contact supprimé) dans les demandes de participation, avec
   source = "contact". Exécutée au démarrage du serveur :
   - les messages de robots (texte aléatoire sans espaces) sont ignorés ;
   - un même message envoyé plusieurs fois n'est importé qu'une fois ;
   - la date d'envoi d'origine est conservée ;
   - idempotente : index unique sur legacyContactId, rien n'est importé deux fois ;
   - l'ancienne collection n'est ni modifiée ni supprimée (sauvegarde). */

export const LEGACY_CONTACT_COLLECTION = "contactsubmissions";

// Jeton « aléatoire » typique des robots : un seul mot, lettres/chiffres,
// minuscules et majuscules mélangées à l'intérieur (ex. zg0mVul5Mp, ETSthMdqTT).
// Un vrai nom, objet ou message contient des espaces ou une casse normale.
function looksRandom(value) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9]{6,}$/.test(text)) return false;
  const innerUppercase = (text.slice(1).match(/[A-Z]/g) || []).length;
  return /[a-z]/.test(text) && (innerUppercase >= 2 || (innerUppercase >= 1 && /\d/.test(text)));
}

export function isLikelySpamContact({ name, subject, message } = {}) {
  const randomFields = [name, subject, message].filter(looksRandom).length;
  const text = String(message ?? "").trim();
  return randomFields >= 2 || (text.length >= 20 && looksRandom(text));
}

// « Gara Raouaa » → { firstName: "Gara", lastName: "Raouaa" }.
export function splitFullName(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: (parts[0] || "").slice(0, 80),
    lastName: parts.slice(1).join(" ").slice(0, 80),
  };
}

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();
const duplicateKey = (doc) => [doc.email, doc.subject, doc.message].map(normalize).join("\u0000");

export function legacyContactToRequest(doc) {
  const { firstName, lastName } = splitFullName(doc.name);
  const email = String(doc.email ?? "").trim().toLowerCase();
  const createdAt = doc.createdAt instanceof Date ? doc.createdAt : doc._id.getTimestamp();
  return {
    source: "contact",
    legacyContactId: doc._id,
    firstName: firstName || email.split("@")[0].slice(0, 80) || "—",
    lastName,
    email,
    subject: String(doc.subject ?? "").trim().slice(0, 180),
    message: String(doc.message ?? "").trim().slice(0, 5000),
    interestKey: "contact",
    status: "new",
    createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : createdAt,
  };
}

const onlyDuplicateKeyErrors = (error) => {
  const writeErrors = error?.writeErrors || error?.result?.getWriteErrors?.() || [];
  return error?.code === 11000 || (writeErrors.length > 0 && writeErrors.every((item) => (item.code ?? item.err?.code) === 11000));
};

export async function migrateLegacyContactMessages() {
  const db = mongoose.connection.db;
  const report = { total: 0, imported: 0, spam: 0, duplicates: 0, invalid: 0, alreadyImported: 0 };
  if (!db) return report;
  const exists = await db.listCollections({ name: LEGACY_CONTACT_COLLECTION }, { nameOnly: true }).hasNext();
  if (!exists) return report;

  // Index uniques prêts avant toute écriture (legacyContactId).
  await EventParticipationRequest.init();
  const legacy = await db.collection(LEGACY_CONTACT_COLLECTION)
    .find({}, { projection: { name: 1, email: 1, subject: 1, message: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  report.total = legacy.length;
  if (!legacy.length) return report;

  const importedIds = new Set((await EventParticipationRequest
    .find({ legacyContactId: { $type: "objectId" } }, { legacyContactId: 1 }).lean())
    .map((item) => String(item.legacyContactId)));

  const seen = new Set();
  const toInsert = [];
  for (const doc of legacy) {
    if (isLikelySpamContact(doc)) { report.spam += 1; continue; }
    const key = duplicateKey(doc);
    if (seen.has(key)) { report.duplicates += 1; continue; }
    seen.add(key);
    if (importedIds.has(String(doc._id))) { report.alreadyImported += 1; continue; }
    const request = legacyContactToRequest(doc);
    try {
      await new EventParticipationRequest(request).validate();
    } catch {
      report.invalid += 1;
      continue;
    }
    toInsert.push(request);
  }

  if (toInsert.length) {
    try {
      // timestamps: false → la date d'envoi d'origine est conservée.
      const inserted = await EventParticipationRequest.insertMany(toInsert, { ordered: false, timestamps: false });
      report.imported = inserted.length;
    } catch (error) {
      // Autre instance du serveur en parallèle : les doublons sont simplement ignorés.
      if (!onlyDuplicateKeyErrors(error)) throw error;
      report.imported = error.insertedDocs?.length ?? error.result?.insertedCount ?? 0;
    }
  }
  return report;
}
