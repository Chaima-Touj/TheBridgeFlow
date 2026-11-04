import mongoose from "mongoose";

const eventRegistrationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["registered", "cancelled"], default: "registered" },
  reminderSentForStartAt: { type: Date, default: null },
  reminderClaimedForStartAt: { type: Date, default: null },
  reminderClaimedAt: { type: Date, default: null },
  reminderNextAttemptAt: { type: Date, default: null },
  reminderAttempts: { type: Number, default: 0 },
}, { timestamps: true });

eventRegistrationSchema.index({ event: 1, student: 1 }, { unique: true });
eventRegistrationSchema.index({ student: 1, status: 1, createdAt: -1 });
eventRegistrationSchema.index({ event: 1, status: 1, reminderSentForStartAt: 1 });

export default mongoose.model("EventRegistration", eventRegistrationSchema);
