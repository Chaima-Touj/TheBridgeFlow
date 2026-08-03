import Groq from "groq-sdk";
import Offer from "../models/offers.model.js";
import User from "../models/users.model.js";

// Singleton — client créé une seule fois au démarrage
let _client = null;
const getClient = () => {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY non configurée dans .env");
  _client = new Groq({ apiKey });
  return _client;
};

async function chat(messages = [], options = {}) {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model:       "llama-3.1-8b-instant",
    messages:    messages.map((m) => ({
      // Passer les 3 rôles supportés par Groq : system, assistant, user
      role:    ["system", "assistant", "user"].includes(m.role) ? m.role : "user",
      content: m.content,
    })),
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.maxTokens  ?? 1024,
  });
  return { text: completion.choices[0]?.message?.content || "" };
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

async function analyzeCV({ text }) {
  if (!text) throw new Error("Aucun texte de CV fourni");

  const prompt = `Analyse ce CV en français et retourne UNIQUEMENT un JSON valide:
{
  "summary": "résumé",
  "skills": ["compétence1"],
  "experiences": [{"role": "", "company": "", "years": ""}],
  "education": "formation principale",
  "recommendations": ["conseil1", "conseil2", "conseil3"]
}

CV: ${text}`;

  const result = await chat([{ role: "user", content: prompt }], { temperature: 0.0, maxTokens: 1000 });

  let parsed = null;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { parsed = null; }

  return { text: result.text, parsed };
}

async function generateMotivationLetter(studentId, offerId, { tone = "formel", length = 300 } = {}) {
  const [student, offer] = await Promise.all([
    User.findById(studentId).lean(),
    Offer.findById(offerId).lean(),
  ]);

  if (!student) throw new Error("Étudiant non trouvé");
  if (!offer)   throw new Error("Offre non trouvée");

  const prompt = `Rédige une lettre de motivation en français, ton ${tone}, environ ${length} mots.

Étudiant: ${student.name}, ${student.specialty}, ${student.university}
Offre: ${offer.title} chez ${offer.companyName || ""} — ${offer.description}

Lettre de motivation:`;

  const result = await chat([{ role: "user", content: prompt }], { temperature: 0.4, maxTokens: 700 });
  return { letter: result.text };
}

export default { chat, recommendInternships, analyzeCV, generateMotivationLetter };
