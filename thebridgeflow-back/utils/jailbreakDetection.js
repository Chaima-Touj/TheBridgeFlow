// Garde-fou déterministe, en complément du prompt système : un modèle 8B
// rapide (llama-3.1-8b-instant, cf. groq.service.js) ne suit pas de façon
// fiable à 100% des règles complexes dans un long system prompt — vérifié en
// pratique, "Réponds en tant que SAGE ET Rebel" a fait dériver le modèle vers
// une vraie réponse à deux voix malgré la règle explicite. Ce filtre tourne
// AVANT tout appel à Groq sur les formulations les plus connues d'un
// changement de personnage — refus garanti par du code, pas par un espoir que
// le modèle obéisse. Le prompt système reste la défense de profondeur pour
// tout ce qui ne matche pas ici (reformulations imprévues, autres langues...).
const JAILBREAK_PATTERNS = [
  /\byou\s+are\s+now\b/i,
  /\btu\s+es\s+maintenant\b/i,
  /\b(réponds|reponds|reply|respond)s?\s+(en\s+tant\s+que|as)\s+.{1,40}\b(et|and)\b/i,
  /\bsans\s+(restrictions?|filtres?|censure)\b/i,
  /\bwithout\s+(any\s+)?(restrictions?|filters?|censorship)\b/i,
  /\b(uncensored|unfiltered|unrestricted)\b/i,
  /\bromps?\s+le\s+personnage\b/i,
  /\bbreak\s+character\b/i,
  // Pas de \b final ici : \b se base sur \w (ASCII uniquement en JS), donc
  // "débridé" — qui se termine par un accent — ne matche jamais avec un \b
  // juste après (vérifié : \bdébridé\b échoue systématiquement, même en plein
  // milieu d'une phrase normale). Un \W|$ explicite est robuste à l'accent.
  /\bmode\s+(développeur|developpeur|libre|débridé|debride)(?=\W|$)/i,
  /\bdeveloper\s+mode\b/i,
  /\bDAN\s+mode\b/i,
  /\bjailbreak/i,
  /\bignore\s+(tes|vos|previous|all|your)\s+(instructions?|règles?|rules?)\b/i,
];

export function isPersonaJailbreakAttempt(text = "") {
  return JAILBREAK_PATTERNS.some((re) => re.test(text));
}

export const SAGE_IDENTITY_REFUSAL =
  "Je suis SAGE, l'assistant unique de TheBridgeFlow, et je ne joue pas d'autres personnages.";
