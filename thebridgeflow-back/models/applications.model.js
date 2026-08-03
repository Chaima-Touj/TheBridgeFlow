import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    offerId:     { type: mongoose.Schema.Types.ObjectId, ref: "Offer", required: true },
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status:      { type: String, enum: ["en attente", "acceptée", "refusée", "en cours"], default: "en attente" },
    coverLetter: { type: String, default: "" },
    cvUrl:       { type: String, default: "" },
    note:        { type: String, default: "" },
  },
  { timestamps: true }
);

// Index unique existant — empêche la double candidature
applicationSchema.index({ offerId: 1, studentId: 1 }, { unique: true });
// Index pour getApplications étudiant
applicationSchema.index({ studentId: 1, createdAt: -1 });
// Index pour getApplications entreprise (par offre)
applicationSchema.index({ offerId: 1, createdAt: -1 });
// Index pour filtrer par statut
applicationSchema.index({ status: 1 });

export default mongoose.model("Application", applicationSchema);
