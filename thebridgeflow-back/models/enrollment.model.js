import mongoose from "mongoose";

const weekProgressSchema = new mongoose.Schema({
  weekNumber:  { type: Number, required: true },
  status:      { type: String, enum: ["not_started", "in_progress", "done"], default: "not_started" },
  completedAt: { type: Date },
}, { _id: false });

const enrollmentSchema = new mongoose.Schema({
  student:  { type: mongoose.Schema.Types.ObjectId, ref: "User",      required: true },
  formation:{ type: mongoose.Schema.Types.ObjectId, ref: "Formation", required: true },
  weekProgress:  [weekProgressSchema],
  overallStatus: { type: String, enum: ["not_started", "in_progress", "completed"], default: "in_progress" },
}, { timestamps: true });

// Un étudiant ne peut s'inscrire qu'une fois à la même formation
enrollmentSchema.index({ student: 1, formation: 1 }, { unique: true });

export default mongoose.model("Enrollment", enrollmentSchema);
