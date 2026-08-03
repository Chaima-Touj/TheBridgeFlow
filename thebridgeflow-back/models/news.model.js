import mongoose from "mongoose";

// Contenu volontairement mono-langue (pas d'objet {fr,en,ar}) : saisi une
// fois par l'admin en français, affiché tel quel dans les 3 langues du site
// — cohérent avec le reste du contenu dynamique (formations, adresses) qui
// n'est pas traduit automatiquement. Décision confirmée avec l'utilisateur.
const newsSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  excerpt:     { type: String, required: true, trim: true },
  content:     { type: String, default: "" },
  category:    { type: String, required: true, trim: true },
  image:       { type: String, required: true },
  author:      { type: String, default: "admin" },
  publishedAt: { type: Date, default: Date.now },
}, { timestamps: true });

newsSchema.index({ publishedAt: -1 });

export default mongoose.model("News", newsSchema);
