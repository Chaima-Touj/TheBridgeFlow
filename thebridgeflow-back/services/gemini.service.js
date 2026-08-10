import { GoogleGenAI } from "@google/genai";
import Offer from "../models/offers.model.js";
import User from "../models/users.model.js";

// Modèle acheté par l'encadrant pas encore connu au moment de ce code — ne
// jamais coder en dur un nom de modèle ici. GEMINI_MODEL doit être renseigné
// dans .env dès que le plan est choisi (voir .env.example) ; ce fallback ne
// sert qu'à ne pas planter avant ça, pas une recommandation figée.
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const getModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

// Singleton — client créé une seule fois au démarrage
let _client = null;
const getClient = () => {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  _client = new GoogleGenAI({ apiKey });
  return _client;
};

async function chat(messages = [], options = {}) {
  const client = getClient();
  if (!client) {
    // Clé pas encore achetée (voir contexte de la migration) — échec propre
    // et identifiable plutôt qu'un crash : errorHandler (voir
    // middleware/error.middleware.js) lit statusCode/code directement sur
    // l'erreur, même mécanisme déjà utilisé pour AI_CONVERSATION_LIMIT_REACHED
    // dans ai.controller.js.
    const err = new Error("Assistant IA temporairement indisponible.");
    err.statusCode = 503;
    err.code = "AI_UNAVAILABLE";
    throw err;
  }

  // Contrairement à Groq (API "OpenAI-style"), Gemini n'a pas de rôle
  // "system" dans son tableau de tours : le prompt système est un paramètre
  // séparé (config.systemInstruction), et les tours passés/futurs utilisent
  // "user"/"model" (pas "assistant"). ai.controller.js continue de préfixer
  // {role:"system", content: systemPrompt} au tableau messages (inchangé,
  // voir buildSystemPrompt) — c'est ici, et seulement ici, qu'on l'extrait
  // et qu'on traduit le reste vers le format attendu par Gemini.
  const systemMessage = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await client.models.generateContent({
    model: getModel(),
    contents,
    config: {
      systemInstruction: systemMessage?.content,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1024,
    },
  });

  return { text: response.text || "" };
}

async function recommendInternships(studentId, limit = 5) {
  const student = await User.findById(studentId).lean();
  if (!student) throw new Error("Étudiant non trouvé");

  const offers = await Offer.find({ isActive: true }).lean();

  const tokenize = (s) => (s || "").toLowerCase().split(/\W+/).filter(Boolean);
  const profileTokens = [
    ...tokenize(student.specialty),
    ...tokenize(student.university),
    ...(student.skills || []).map((s) => s.name?.toLowerCase()).filter(Boolean),
  ];

  const scored = offers.map((offer) => {
    const tokens = [
      ...tokenize(offer.title),
      ...tokenize(offer.description),
      ...(offer.skills || []).map((s) => s.toLowerCase()),
      ...tokenize(offer.domain),
    ];
    const common = tokens.filter((t) => profileTokens.includes(t)).length;
    return { offer, score: common };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map((s) => s.offer);

  const prompt = `Tu es un conseiller en orientation professionnelle.
Explique en 2-3 phrases pourquoi chaque offre convient à cet étudiant.
Donne aussi 3 conseils pour améliorer sa candidature.

Profil: ${student.name}, ${student.specialty}, ${student.university}

Offres:
${top.map((o, i) => `${i + 1}. ${o.title} - ${o.companyName || ""} | ${o.domain} | ${(o.skills || []).join(", ")}`).join("\n")}

Réponds en français.`;

  const result = await chat([{ role: "user", content: prompt }], { temperature: 0.3, maxTokens: 800 });
  return { offers: top, analysis: result.text };
}

export default { chat, recommendInternships };
