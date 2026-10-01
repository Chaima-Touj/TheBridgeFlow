import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 10000 },
  image: { type: String, default: "", trim: true, maxlength: 2048 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, default: null },
  timezone: { type: String, default: "Africa/Tunis", trim: true, maxlength: 100 },
  mode: { type: String, enum: ["onsite", "online", "hybrid"], default: "onsite" },
  location: { type: String, default: "", trim: true, maxlength: 500 },
  meetingUrl: { type: String, default: "", trim: true, maxlength: 2048 },
  capacity: { type: Number, default: null, min: 1 },
  registrationRequired: { type: Boolean, default: true },
  registrationCount: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ["draft", "published", "cancelled", "archived"],
    default: "draft",
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

eventSchema.index({ status: 1, startsAt: 1 });

export default mongoose.model("Event", eventSchema);
