// Dictionnaire centralisé slug technologie -> logo, réutilisé par TechMarquee
// (Landing + FormationDetail) et par la grille "Formations Populaires" pour
// les badges technos.
//
// Tous les logos sont des icônes vectorielles react-icons/si (simple-icons),
// sauf SQL et Power BI (icônes Feather génériques, aucun logo dédié). Le type "image" (PNG de public/images/course-placeholders/) a été
// abandonné : ces PNG sont en réalité des ARRIÈRE-PLANS de miniature vidéo
// (16:9, dégradé + cercles décoratifs), pas des logos autonomes — le mark de
// marque y est délavé/à faible contraste, illisible en petit badge. Un cas
// (php.png) contenait même le mauvais logo (Node.js au lieu de PHP). Ces PNG
// restent utilisés ailleurs (thumbUtils.js, miniatures de semaines) où ce
// style d'arrière-plan est approprié — seul leur usage ici, comme logo de
// badge, était erroné.
//
// Logos volontairement absents (aucun asset dans le projet, aucune icône
// simple-icons correspondante) :
//   - Photoshop, Illustrator, Lightroom, Premiere Pro, After Effects : licence
//     Adobe non distribuée par simple-icons.
//   - Microsoft : aucun logo générique Microsoft dans simple-icons.
//   - SonarQube : aucune icône dans simple-icons (vérifié).
//   - VS Code : aucune icône fiable trouvée. `SiVsco` existe mais correspond
//     très probablement à l'application photo "VSCO" (collision de nom, pas
//     Visual Studio Code) ; `DiVisualstudio` (devicons) est Visual Studio
//     (l'IDE complet), un produit différent. Plutôt que d'afficher un logo
//     potentiellement faux, VS Code est omis.
import {
  SiReact, SiNodedotjs, SiMongodb, SiJavascript, SiTypescript, SiPython,
  SiDocker, SiHtml5, SiVuedotjs, SiAngular, SiPhp,
  SiExpress, SiCss, SiWordpress, SiGoogleads, SiFlutter, SiSpringboot,
  SiArduino, SiEspressif, SiMqtt,
  SiKubernetes, SiJenkins, SiGithubactions, SiAnsible, SiTerraform, SiArgo,
  SiKalilinux, SiOpenai, SiTensorflow, SiNextdotjs,
  SiTalend, SiDart, SiFlask, SiPostman, SiCanva, SiMeta, SiOwasp,
} from "react-icons/si";
import { FiDatabase, FiBarChart2 } from "react-icons/fi";

export const TECH_LOGOS = {
  react:      { type: "icon", Comp: SiReact,      label: "React",      color: "#61DAFB" },
  nextjs:     { type: "icon", Comp: SiNextdotjs,  label: "Next.js",    color: "#000000" },
  nodejs:     { type: "icon", Comp: SiNodedotjs,  label: "Node.js",    color: "#339933" },
  mongodb:    { type: "icon", Comp: SiMongodb,    label: "MongoDB",    color: "#47A248" },
  javascript: { type: "icon", Comp: SiJavascript, label: "JavaScript", color: "#F7DF1E" },
  typescript: { type: "icon", Comp: SiTypescript, label: "TypeScript", color: "#3178C6" },
  python:     { type: "icon", Comp: SiPython,     label: "Python",     color: "#3776AB" },
  docker:     { type: "icon", Comp: SiDocker,     label: "Docker",     color: "#2496ED" },
  html:       { type: "icon", Comp: SiHtml5,      label: "HTML5",      color: "#E34F26" },
  vue:        { type: "icon", Comp: SiVuedotjs,   label: "Vue.js",     color: "#4FC08D" },
  angular:    { type: "icon", Comp: SiAngular,    label: "Angular",    color: "#DD0031" },
  php:        { type: "icon", Comp: SiPhp,        label: "PHP",        color: "#777BB4" },

  express:   { type: "icon", Comp: SiExpress,   label: "Express",    color: "#000000" },
  sql:       { type: "icon", Comp: FiDatabase,  label: "SQL",        color: "#4479A1" }, // pas de logo SQL générique dans simple-icons
  css3:      { type: "icon", Comp: SiCss,       label: "CSS3",       color: "#1572B6" },
  wordpress: { type: "icon", Comp: SiWordpress, label: "WordPress",  color: "#21759B" },
  googleads: { type: "icon", Comp: SiGoogleads, label: "Google Ads", color: "#4285F4" },

  // Technologies réellement utilisées par des formations existantes mais
  // absentes de la liste initialement demandée (mobile-flutter,
  // fullstack-spring-angular) — icônes déjà utilisées ailleurs dans le
  // projet (ICON_MAP de LandingPage/FormationDetail), donc sûres.
  flutter:    { type: "icon", Comp: SiFlutter,    label: "Flutter",    color: "#54C5F8" },
  springboot: { type: "icon", Comp: SiSpringboot, label: "Spring Boot",color: "#6DB33F" },
  // Formation Flutter — Dart, le langage de Flutter (programme : « Prise en
  // main de Dart », « Configuration Flutter & Dart »).
  dart:       { type: "icon", Comp: SiDart,       label: "Dart",       color: "#0175C2" },

  // Formation IoT — technologies réellement enseignées (weeks[].content).
  // Pas d'icône "ESP32" dédiée dans simple-icons -> logo Espressif (fabricant
  // de l'ESP32) avec le libellé "ESP32", la carte réellement utilisée. Le slug
  // reste "espressif" : c'est celui enregistré dans formation.technologies.
  // Postman : test des API IoT avant le développement mobile (programme).
  arduino:   { type: "icon", Comp: SiArduino,   label: "Arduino",   color: "#00979D" },
  espressif: { type: "icon", Comp: SiEspressif, label: "ESP32",     color: "#E7352C" },
  mqtt:      { type: "icon", Comp: SiMqtt,      label: "MQTT",      color: "#660066" },
  postman:   { type: "icon", Comp: SiPostman,   label: "Postman",   color: "#FF6C37" },

  // Formation BI — Talend (préparation des données) et Power BI (tableaux de
  // bord). Aucune icône "Power BI" dans simple-icons : icône de graphique
  // générique aux couleurs de Power BI, comme "sql" avec FiDatabase. Le slug
  // "powerbi" est celui enregistré dans formation.technologies (formation "bi").
  talend:  { type: "icon", Comp: SiTalend,    label: "Talend",   color: "#FF6D70" },
  powerbi: { type: "icon", Comp: FiBarChart2, label: "Power BI", color: "#F2C811" },

  // Formation Marketing Digital — Meta Ads (campagnes) et Canva (design).
  metaads: { type: "icon", Comp: SiMeta,  label: "Meta Ads", color: "#0467DF" },
  canva:   { type: "icon", Comp: SiCanva, label: "Canva",    color: "#00C4CC" },

  // Formation DevOps — technologies réellement enseignées. SonarQube n'a pas
  // d'icône dans simple-icons, omis.
  kubernetes:    { type: "icon", Comp: SiKubernetes,    label: "Kubernetes",     color: "#326CE5" },
  jenkins:       { type: "icon", Comp: SiJenkins,       label: "Jenkins",        color: "#D33833" },
  githubactions: { type: "icon", Comp: SiGithubactions, label: "GitHub Actions", color: "#2088FF" },
  ansible:       { type: "icon", Comp: SiAnsible,       label: "Ansible",        color: "#EE0000" },
  terraform:     { type: "icon", Comp: SiTerraform,     label: "Terraform",      color: "#7B42BC" },
  argocd:        { type: "icon", Comp: SiArgo,          label: "ArgoCD",         color: "#EF7B4D" },

  // Cybersécurité — Kali Linux (distribution de référence en pentesting,
  // effectivement utilisée dans le programme de la formation) et OWASP
  // (« OWASP Top 10 », « OWASP en pratique »). Logo OWASP monochrome (noir) :
  // var(--text) le garde lisible en thème clair comme en thème sombre.
  kalilinux: { type: "icon", Comp: SiKalilinux, label: "Kali Linux", color: "#557C94" },
  owasp:     { type: "icon", Comp: SiOwasp,     label: "OWASP",      color: "var(--text)" },

  // IA / Chatbot / Recommandation — deux logos reconnaissables plutôt qu'une
  // icône robot générique, comme demandé si disponible. Flask : déploiement
  // des modèles d'IA dans une application web (programme) ; logo monochrome,
  // même traitement var(--text) qu'OWASP.
  openai:     { type: "icon", Comp: SiOpenai,     label: "OpenAI",     color: "#412991" },
  tensorflow: { type: "icon", Comp: SiTensorflow, label: "TensorFlow", color: "#FF6F00" },
  flask:      { type: "icon", Comp: SiFlask,      label: "Flask",      color: "var(--text)" },
};

// Liste ordonnée pour la bande statique de la Landing Page — vitrine des
// technologies enseignées dans les formations de la plateforme, indépendante
// de formation.technologies (qui reste utilisé uniquement sur FormationDetail,
// voir Feature 3B). Adobe Suite, Microsoft, SonarQube et VS Code omis (voir
// note en tête de fichier).
// PHP, Next.js, Vue.js, WordPress et Arduino sont retirés de cette bande à la
// demande du propriétaire, mais gardent leur entrée dans TECH_LOGOS :
// FormationDetail affiche formation.technologies (base de données), qui
// contient encore nextjs, wordpress et arduino.
export const LANDING_MARQUEE_SLUGS = [
  // MERN stack
  "mongodb", "express", "react", "nodejs",
  // Angular + Spring Boot
  "angular", "springboot",
  // Flutter / Dart
  "flutter", "dart",
  // JavaScript / HTML5 / CSS3 / TypeScript
  "javascript", "html", "css3", "typescript",
  // IA / Chatbot / Recommandation
  "openai", "tensorflow", "flask",
  // Cybersécurité
  "kalilinux", "owasp",
  // IoT
  "espressif", "mqtt", "postman",
  // BI / Business Intelligence
  "sql", "powerbi", "talend",
  // DevOps
  "docker", "kubernetes", "jenkins", "githubactions", "ansible", "terraform", "argocd",
  // Marketing Digital
  "googleads", "metaads", "canva",
  // Python — utilisé dans plusieurs formations (IA, BI, Cybersécurité)
  "python",
];

export function getTechLogo(slug) {
  return TECH_LOGOS[slug] || null;
}
