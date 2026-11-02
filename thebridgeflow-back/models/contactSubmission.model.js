import mongoose from "mongoose";

const contactSubmissionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  subject: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  isRead: { type: Boolean, default: false, index: true },
}, { timestamps: true });

contactSubmissionSchema.index({ createdAt: -1 });

export default mongoose.model("ContactSubmission", contactSubmissionSchema);
