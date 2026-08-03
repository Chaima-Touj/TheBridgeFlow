import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["convention", "attestation", "rapport", "cahier_de_charge", "autre"], 
      required: true 
    },
    fileUrl: { type: String, required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { 
      type: String, 
      enum: ["en_attente", "validé", "refusé"], 
      default: "en_attente" 
    },
    feedback: { type: String, default: "" }, // note de l'encadrant si refusé/validé
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
