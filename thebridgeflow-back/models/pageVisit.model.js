import mongoose from "mongoose";

const pageVisitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  path: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index pour des requêtes de comptage efficaces par path
pageVisitSchema.index({ path: 1 });

const PageVisit = mongoose.model("PageVisit", pageVisitSchema);

export default PageVisit;

