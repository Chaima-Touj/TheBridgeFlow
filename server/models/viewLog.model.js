import mongoose from "mongoose";

const viewLogSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
    targetType: { type: String, enum: ["offer", "formation"], required: true },
    targetId:   { type: mongoose.Schema.Types.ObjectId, required: true },
    timestamp:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index composé pour requêtes par type+cible triées par date décroissante
viewLogSchema.index({ targetType: 1, targetId: 1, timestamp: -1 });

export default mongoose.model("ViewLog", viewLogSchema);
