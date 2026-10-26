import mongoose from "mongoose";

// Contenu volontairement mono-langue (pas d'objet {fr,en,ar}) : saisi une
// fois par l'admin en français, affiché tel quel dans les 3 langues du site
// — cohérent avec le reste du contenu dynamique (formations, adresses) qui
// n'est pas traduit automatiquement. Décision confirmée avec l'utilisateur.
const newsSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  excerpt:     { type: String, required: true, trim: true },
  content:     { type: String, default: "" },
  conclusion:  { type: String, default: "" },
  ctaLabel:    { type: String, default: "", trim: true, maxlength: 100 },
  ctaUrl:      { type: String, default: "", trim: true, maxlength: 2048 },
  metaTitle:   { type: String, default: "", trim: true, maxlength: 70 },
  metaDescription: { type: String, default: "", trim: true, maxlength: 320 },
  faq: {
    type: [{
      question: { type: String, required: true, trim: true, maxlength: 300 },
      answer:   { type: String, required: true, trim: true, maxlength: 10000 },
    }],
    default: [],
  },
  category:    { type: String, required: true, trim: true },
  image:       { type: String, required: true },
  author:      { type: String, default: "admin" },
  publishedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["draft", "published"], default: undefined, index: true },
  newsletterCampaignEligibleAt: { type: Date, default: null },
  newsletterCampaignClaimedAt: { type: Date, default: null },
  newsletterCampaignSentAt: { type: Date, default: null },
}, { timestamps: true });

newsSchema.index({ publishedAt: -1 });
newsSchema.index({ status: 1, publishedAt: -1 });

export default mongoose.model("News", newsSchema);
