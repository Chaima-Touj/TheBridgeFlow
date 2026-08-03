import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title:       { type: String, required: [true, "Titre requis"], trim: true },
    description: { type: String, default: "" },
    companyName: { type: String, default: "" },
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    domain:      { type: String, default: "", index: true },
    location:    { type: String, default: "" },
    duration:    { type: String, default: "" },
    type:        { type: String, enum: ["stage", "PFE", "alternance", "formation", "vidéo"], default: "stage", index: true },
    skills:      [{ type: String }],
    salary:      { type: Number, default: 0 },
    deadline:    { type: Date },
    isActive:    { type: Boolean, default: true, index: true },
    views:       { type: Number, default: 0 },
    nbrInterns:  { type: String, default: "" },
  },
  { timestamps: true }
);

// Index texte pour la recherche full-text
offerSchema.index({ title: "text", description: "text", companyName: "text", skills: "text" });

export default mongoose.model("Offer", offerSchema);
