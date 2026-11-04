import mongoose from "mongoose";

const pfePackRegistrationSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, required: true, trim: true, maxlength: 80 },
  phone: { type: String, required: true, trim: true, maxlength: 32 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
  technologies: { type: [String], required: true, validate: [(values) => values.length > 0, "Indiquez au moins une technologie."] },
  subject: { type: String, required: true, trim: true, maxlength: 3000 },
}, { timestamps: true });

export default mongoose.model("PfePackRegistration", pfePackRegistrationSchema);
