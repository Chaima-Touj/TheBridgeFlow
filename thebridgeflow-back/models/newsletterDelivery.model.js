import mongoose from "mongoose";

const newsletterDeliverySchema = new mongoose.Schema({
  deliveryKey: { type: String, required: true, unique: true },
  kind: { type: String, enum: ["welcome", "admin", "publication"], required: true },
  recipientEmail: { type: String, required: true, trim: true, lowercase: true },
  recipientName: { type: String, default: "" },
  language: { type: String, enum: ["fr", "en", "ar"], default: "fr" },
  subscriber: { type: mongoose.Schema.Types.ObjectId, ref: "NewsletterSubscriber", default: null },
  subscriptionVersion: { type: Number, default: null, min: 1 },
  sourceType: { type: String, enum: ["news", "event", null], default: null },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  encryptedToken: { type: String, default: null, select: false },
  tokenIv: { type: String, default: null, select: false },
  tokenAuthTag: { type: String, default: null, select: false },
  status: { type: String, enum: ["pending", "sending", "sent", "failed", "skipped"], default: "pending", index: true },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  claimedAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
}, { timestamps: true });

newsletterDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model("NewsletterDelivery", newsletterDeliverySchema);
