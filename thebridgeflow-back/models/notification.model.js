import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    type:    { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    isRead:  { type: Boolean, default: false },
    link:    { type: String, default: "" },
  },
  { timestamps: true }
);

// Index composé — toutes les requêtes filtrent par userId puis trient par date
notificationSchema.index({ userId: 1, createdAt: -1 });
// Index pour marquer comme lues rapidement
notificationSchema.index({ userId: 1, isRead: 1 });

export default mongoose.model("Notification", notificationSchema);
