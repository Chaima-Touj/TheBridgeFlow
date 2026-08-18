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
  },
  { timestamps: true }
);

// Tri principal du leaderboard
ceremonyProjectSchema.index({ voteCount: -1 });
// Page "Mes projets" (dashboard étudiant)
ceremonyProjectSchema.index({ studentId: 1 });

export default mongoose.model("CeremonyProject", ceremonyProjectSchema);
