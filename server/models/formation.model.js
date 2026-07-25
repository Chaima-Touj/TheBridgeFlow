import mongoose from "mongoose";

const weekSchema = new mongoose.Schema({
  week:     { type: Number, required: true },
  phase:    { type: String, default: "" },
  content:  { type: String, required: true },
  videoUrl:   { type: String, default: "" },
  videoTitle: { type: String, default: "" },
  thumbnail:  { type: String, default: "" },
  duree:    { type: String, default: "" },
  gratuit:  { type: Boolean, default: false },
}, { _id: false });

const videoSchema = new mongoose.Schema({
  url:       { type: String, required: true },
  title:     { type: String, default: "" },
  thumbnail: { type: String, default: "" },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  avatar:  { type: String, default: "" },
  rating:  { type: Number, min: 1, max: 5, default: 5 },
  comment: { type: String, default: "" },
  date:    { type: Date, default: Date.now },
});

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer:   { type: String, required: true },
}, { _id: false });

const formationSchema = new mongoose.Schema({
  title:       { type: String, required: true, unique: true },
  slug:        { type: String, required: true, unique: true },
  duration:    { type: String, required: true },
  price: {
    onsite: { type: String, required: true },
    online: { type: String, required: true },
  },
  schedule:    { type: String, required: true },
  level:       { type: String, default: "Intermédiaire" },
  description: { type: String, default: "" },
  weeks:      [weekSchema],
  supervision: [weekSchema],

  // ── Extended fields for detail page ──────────────────────────────────────
  mode:        { type: String, enum: ["Présentiel", "En ligne", "Hybride"], default: "Hybride" },
  certificate: { type: Boolean, default: false },
  image:       { type: String, default: "" },
  features:    { type: [String], default: [] },
  // Slugs technos (ex: "react", "nodejs", "mongodb") mappés via
  // client/src/constants/techLogos.js pour la bande de logos de la page détail.
  technologies: { type: [String], default: [] },
  videos:      [videoSchema],
  reviews:     [reviewSchema],
  stats: {
    students:      { type: Number, default: 0 },
    successRate:   { type: Number, default: 0 },
    insertionRate: { type: Number, default: 0 },
    satisfaction:  { type: Number, default: 0 },
  },
  faq: [faqSchema],

  // ── Trailer (vidéo de présentation globale) ───────────────────────────────
  trailerVideoUrl:  { type: String, default: "" },
  trailerThumbnail: { type: String, default: "" },

  // ── Statistiques de consultation ──────────────────────────────────────────
  views: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("Formation", formationSchema);
