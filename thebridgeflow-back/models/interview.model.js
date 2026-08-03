import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    studentId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scheduledAt:   { type: Date, required: true },
    mode:          { type: String, enum: ["présentiel", "en ligne"], default: "en ligne" },
    location:      { type: String, default: "" },
    status:        { type: String, enum: ["proposé", "confirmé", "annulé", "terminé"], default: "proposé" },
    notes:         { type: String, default: "" },
  },
  { timestamps: true }
);

// Index pour getInterviews étudiant
interviewSchema.index({ studentId: 1, scheduledAt: 1 });
// Index pour getInterviews entreprise
interviewSchema.index({ companyId: 1, scheduledAt: 1 });
// Index pour filtrer par statut
interviewSchema.index({ status: 1 });

export default mongoose.model("Interview", interviewSchema);
