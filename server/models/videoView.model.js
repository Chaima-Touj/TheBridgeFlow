import mongoose from "mongoose";

const videoViewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  videoIdentifier: {
    type: String,
    required: true,
  },
  videoLabel: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index pour des requêtes de comptage efficaces par vidéo
videoViewSchema.index({ videoIdentifier: 1 });

const VideoView = mongoose.model("VideoView", videoViewSchema);

export default VideoView;

