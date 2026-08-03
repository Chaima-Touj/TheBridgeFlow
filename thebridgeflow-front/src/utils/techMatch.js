// Fait correspondre un tag de compétence affiché sur une offre (ex: "React.js",
// "Java Spring Boot") à la formation qui l'enseigne, via le champ
// `technologies` (slugs, ex: "react", "springboot") de chaque formation.
//
// Les tags d'offres sont du texte libre saisi par les entreprises, jamais des
// slugs — un match par égalité stricte ne trouverait donc quasiment rien. On
// normalise le texte du tag et on cherche, pour chaque slug technologie, un
// alias correspondant en tant que mot entier (`\balias\b`) dans ce texte —
// ex: "sql" ne doit PAS matcher à l'intérieur de "PostgreSQL"/"MySQL".
const TECH_ALIASES = {
  react:         ["react.js", "react js", "reactjs", "react"],
  nextjs:        ["next.js", "next js", "nextjs"],
  nodejs:        ["node.js", "node js", "nodejs", "node"],
  express:       ["express.js", "express js", "expressjs", "express"],
  mongodb:       ["mongodb", "mongo"],
  angular:       ["angular"],
  springboot:    ["spring boot", "springboot", "spring"],
  flutter:       ["flutter"],
  docker:        ["docker"],
  kubernetes:    ["kubernetes", "k8s"],
  jenkins:       ["jenkins"],
  githubactions: ["github actions", "githubactions"],
  ansible:       ["ansible"],
  terraform:     ["terraform"],
  argocd:        ["argocd", "argo cd", "argo"],
  kalilinux:     ["kali linux", "kalilinux", "kali"],
  openai:        ["openai", "open ai"],
  tensorflow:    ["tensorflow", "tensor flow"],
  arduino:       ["arduino"],
  espressif:     ["esp32", "espressif"],
  mqtt:          ["mqtt"],
  sql:           ["sql"],
  powerbi:       ["power bi", "powerbi", "power-bi"],
  wordpress:     ["wordpress"],
  googleads:     ["google ads", "googleads"],
};

function normalize(text) {
  return String(text).toLowerCase().replace(/[.()/]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillMatchesSlug(normalizedSkill, slug) {
  const aliases = TECH_ALIASES[slug];
  if (!aliases) return false;

  // "React Native" est un framework mobile distinct de React (web) — le
  // générique "react" ne doit pas s'y accrocher juste parce que le mot y
  // apparaît. Les formes explicites ("react.js", "reactjs"...) restent
  // testées normalement, seule la forme nue "react" ignore ce segment.
  const skillForAlias = (alias) =>
    slug === "react" && alias === "react"
      ? normalizedSkill.replace(/\breact native\b/g, "")
      : normalizedSkill;

  return aliases.some((alias) =>
    new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(skillForAlias(alias))
  );
}

/**
 * @param {Array<{slug, title, technologies}>} formations
 * @returns {(skill: string) => {slug, title} | null}
 * Renvoie la première formation (dans l'ordre du tableau `formations`) dont
 * `technologies` contient une techno correspondant au tag `skill`.
 */
export function buildSkillFormationMatcher(formations) {
  return function matchFormationForSkill(skill) {
    const normalized = normalize(skill);
    for (const formation of formations) {
      const techs = formation.technologies || [];
      if (techs.some((slug) => skillMatchesSlug(normalized, slug))) {
        return formation;
      }
    }
    return null;
  };
}
