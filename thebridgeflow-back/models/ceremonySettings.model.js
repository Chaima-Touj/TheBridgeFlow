import mongoose from "mongoose";

// Document singleton — un seul document existe jamais dans cette collection
// (voir getOrCreateCeremonySettings dans ceremony.controller.js), même
// pattern que SiteSettings (siteSettings.model.js).
const ceremonySettingsSchema = new mongoose.Schema(
  {
    voteStartDate: { type: Date, default: null },
    voteEndDate:   { type: Date, default: null },
    // Fermeture manuelle (via "Clôturer et annoncer le gagnant"), indépendante
    // de voteEndDate — un admin peut clôturer avant la date prévue.
    isVoteClosed:    { type: Boolean, default: false },
    winnerProjectId: { type: mongoose.Schema.Types.ObjectId, ref: "CeremonyProject", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("CeremonySettings", ceremonySettingsSchema);
