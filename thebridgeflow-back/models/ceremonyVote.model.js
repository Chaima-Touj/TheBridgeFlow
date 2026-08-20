import mongoose from "mongoose";

const ceremonyVoteSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    projectIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "CeremonyProject" }],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 1 && arr.length <= 3,
        message: "Un vote doit contenir entre 1 et 3 projets.",
      },
    },
  },
  { timestamps: true }
);

// `unique: true` sur studentId ci-dessus crée déjà l'index — un seul document
// de vote par étudiant, appliqué au niveau base (pas seulement côté
// contrôleur) pour empêcher tout double vote même en cas de requêtes
// concurrentes.

export default mongoose.model("CeremonyVote", ceremonyVoteSchema);
