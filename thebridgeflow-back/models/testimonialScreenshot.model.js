import mongoose from "mongoose";

const testimonialScreenshotSchema = new mongoose.Schema({
  imageUrl:  { type: String, required: true },
  name:      { type: String, default: "" },
  order:     { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("TestimonialScreenshot", testimonialScreenshotSchema);
