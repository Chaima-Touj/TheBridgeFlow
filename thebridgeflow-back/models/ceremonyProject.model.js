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
  },
  { timestamps: true }
);

// Tri principal du leaderboard
ceremonyProjectSchema.index({ voteCount: -1 });
// Page "Mes projets" (dashboard étudiant)
ceremonyProjectSchema.index({ studentId: 1 });

export default mongoose.model("CeremonyProject", ceremonyProjectSchema);
