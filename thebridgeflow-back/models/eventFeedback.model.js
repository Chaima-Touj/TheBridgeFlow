import mongoose from "mongoose";

const eventFeedbackSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  comment: { type: String, required: true, trim: true, maxlength: 2000 },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  image: { type: String, default: "", maxlength: 1_000_000 },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

eventFeedbackSchema.index({ event: 1, student: 1 }, { unique: true });
eventFeedbackSchema.index({ event: 1, isPublished: 1, createdAt: -1 });

export default mongoose.model("EventFeedback", eventFeedbackSchema);
