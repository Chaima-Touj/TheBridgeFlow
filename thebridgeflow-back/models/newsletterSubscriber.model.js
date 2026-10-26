import mongoose from "mongoose";

const newsletterSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  language: { type: String, enum: ["fr", "en", "ar"], default: "fr" },
  subscribed: { type: Boolean, default: true, index: true },
  unsubscribeTokenHash: { type: String, required: true, unique: true, select: false },
  encryptedUnsubscribeToken: { type: String, default: null, select: false },
  unsubscribeTokenIv: { type: String, default: null, select: false },
  unsubscribeTokenAuthTag: { type: String, default: null, select: false },
  subscriptionVersion: { type: Number, default: 1, min: 1 },
  subscribedAt: { type: Date, default: Date.now },
  unsubscribedAt: { type: Date, default: null },
}, { timestamps: true });

newsletterSubscriberSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
