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
    // Édition en cours (ex. 2026) — permet de relancer un nouveau cycle de
    // soumission/vote sans perdre l'historique : CeremonyProject.edition < ce
    // champ = archivé (voir getCeremonyArchives). Toujours un seul document
    // dans cette collection (singleton), donc "édition en cours" = la seule
    // valeur qui existe ici à un instant T. default appliqué aux nouveaux
    // documents seulement — le document existant a été backfillé par le
    // script scripts/backfillCeremonyEdition.js (même piège .lean() que le
    // champ status de CeremonyProject : le default ne s'applique pas à
    // l'hydratation .lean() des documents déjà en base).
    edition: { type: Number, required: true, default: 2026 },
  },
  { timestamps: true }
);

export default mongoose.model("CeremonySettings", ceremonySettingsSchema);
