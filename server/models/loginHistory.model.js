import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Date, default: Date.now },
    method:    { type: String, enum: ["email", "google", "facebook"], required: true },
    location: {
      country:  { type: String },
      city:     { type: String },
      timezone: { type: String },
    },
  },
  { timestamps: true }
);

// Index composé pour requêtes par utilisateur triées par date
loginHistorySchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model("LoginHistory", loginHistorySchema);

