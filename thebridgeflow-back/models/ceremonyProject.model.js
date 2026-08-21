import mongoose from "mongoose";

const ceremonyProjectSchema = new mongoose.Schema(
  {
    studentId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title:         { type: String, required: true, trim: true },
    description:   { type: String, default: "" },
    technologies:  [{ type: String }],
    // Image de couverture en base64 (compressImageToBase64, même pattern que
    // News.image / Formation.weeks[].thumbnail) — pas d'upload disque,
    // filesystem Render non persistant en production.
    coverImage:    { type: String, default: "" },
    driveAppUrl:   { type: String, default: "" },
    driveVideoUrl: { type: String, default: "" },
    githubUrl:     { type: String, default: "" },
    teamMembers:   [{ type: String }],
    // Dénormalisé pour trier le leaderboard sans agrégation sur CeremonyVote
    // à chaque requête — incrémenté via $inc au moment du vote (voir
    // ceremony.controller.js:vote).
    voteCount:     { type: Number, default: 0 },
    // Marqueur des projets de démo créés par scripts/seedCeremonyProjects.js
    // (--clean s'appuie dessus pour ne retirer QUE ces documents) — jamais
    // mis à true par le flux normal de création (ceremony.controller.js
    // n'écrit jamais ce champ), donc aucun vrai projet ne peut le porter.
    isSeedData:    { type: Boolean, default: false },
    // Modération admin — default "approuvé" pour que tout document déjà en
    // base avant l'ajout de ce champ reste visible publiquement sans action
    // manuelle (Mongoose applique ce default à l'hydratation d'un Document,
    // hors requêtes .lean() — voir la migration one-off qui a physiquement
    // backfillé ce champ sur les documents pré-existants). Les nouvelles
    // soumissions étudiant (createProject) écrasent explicitement ce default
    // avec "en_attente" : c'est le vrai portail de modération.
    status: {
      type: String,
      enum: ["en_attente", "approuvé", "refusé"],
      default: "approuvé",
    },
    // Édition à laquelle ce projet appartient (ex. 2026) — renseignée à la
    // création depuis CeremonySettings.edition (voir createProject). Toutes
    // les requêtes publiques/admin filtrent désormais sur l'édition
    // courante ; edition < courante = projet archivé, visible uniquement via
    // getCeremonyArchives/getCeremonyArchiveEdition. default ici ne couvre
    // que les nouveaux documents — les documents existants ont été
    // backfillés par scripts/backfillCeremonyEdition.js (même piège .lean()
    // documenté sur le champ status ci-dessus).
    edition: { type: Number, required: true, default: 2026 },
  },
  { timestamps: true }
);

// Tri principal du leaderboard (par édition, voir getLeaderboard)
ceremonyProjectSchema.index({ edition: 1, voteCount: -1 });
// Modération admin + grille publique, toutes deux filtrées par édition
ceremonyProjectSchema.index({ edition: 1, status: 1 });
// Page "Mes projets" (dashboard étudiant)
ceremonyProjectSchema.index({ studentId: 1 });

export default mongoose.model("CeremonyProject", ceremonyProjectSchema);
