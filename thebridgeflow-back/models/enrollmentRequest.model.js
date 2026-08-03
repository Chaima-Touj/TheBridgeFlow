import mongoose from "mongoose";

const enrollmentRequestSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: "User",      required: true },
  formation: { type: mongoose.Schema.Types.ObjectId, ref: "Formation", required: true },
  mode:      { type: String, enum: ["Présentiel", "En ligne"], required: true },
  message:   { type: String, default: "" },
  status:    { type: String, enum: ["en_attente", "acceptée", "refusée"], default: "en_attente" },
}, { timestamps: true });

// Un étudiant ne peut soumettre qu'une seule demande par formation
enrollmentRequestSchema.index({ student: 1, formation: 1 }, { unique: true });

export default mongoose.model("EnrollmentRequest", enrollmentRequestSchema);
