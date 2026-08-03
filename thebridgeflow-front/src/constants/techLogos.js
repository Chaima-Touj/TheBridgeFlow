// Dictionnaire centralisé slug technologie -> logo, réutilisé par TechMarquee
// (Landing + FormationDetail) et par la grille "Formations Populaires" pour
// les badges technos.
//
// Tous les logos sont des icônes vectorielles react-icons/si (simple-icons).
// Le type "image" (PNG de public/images/course-placeholders/) a été
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
//   - Power BI : aucune icône "Power BI" dans simple-icons (vérifié, re-vérifié
//     dans devicons/bootstrap-icons/fontawesome — rien nulle part dans le
//     projet). Le slug "powerbi" existe quand même sur la formation "bi", mais
//     uniquement pour le matching techno→formation (voir techMatch.js) : privé
//     d'entrée ici, il est filtré silencieusement par TechMarquee et n'affiche
//     donc aucun badge, plutôt que d'afficher un logo faux.
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
} from "react-icons/si";
import { FiDatabase } from "react-icons/fi";

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

  // Formation IoT — technologies réellement enseignées (weeks[].content).
  // Pas d'icône "ESP32" dédiée dans simple-icons -> Espressif (fabricant de
  // l'ESP32) est le logo le plus proche disponible.
  arduino:   { type: "icon", Comp: SiArduino,   label: "Arduino",   color: "#00979D" },
  espressif: { type: "icon", Comp: SiEspressif, label: "Espressif", color: "#E7352C" },
  mqtt:      { type: "icon", Comp: SiMqtt,      label: "MQTT",      color: "#660066" },

  // Formation DevOps — technologies réellement enseignées. SonarQube n'a pas
  // d'icône dans simple-icons, omis.
  kubernetes:    { type: "icon", Comp: SiKubernetes,    label: "Kubernetes",     color: "#326CE5" },
  jenkins:       { type: "icon", Comp: SiJenkins,       label: "Jenkins",        color: "#D33833" },
  githubactions: { type: "icon", Comp: SiGithubactions, label: "GitHub Actions", color: "#2088FF" },
  ansible:       { type: "icon", Comp: SiAnsible,       label: "Ansible",        color: "#EE0000" },
  terraform:     { type: "icon", Comp: SiTerraform,     label: "Terraform",      color: "#7B42BC" },
  argocd:        { type: "icon", Comp: SiArgo,          label: "ArgoCD",         color: "#EF7B4D" },

  // Cybersécurité — Kali Linux (distribution de référence en pentesting,
  // effectivement utilisée dans le programme de la formation).
  kalilinux: { type: "icon", Comp: SiKalilinux, label: "Kali Linux", color: "#557C94" },

  // IA / Chatbot / Recommandation — deux logos reconnaissables plutôt qu'une
  // icône robot générique, comme demandé si disponible.
  openai:     { type: "icon", Comp: SiOpenai,     label: "OpenAI",     color: "#412991" },
  tensorflow: { type: "icon", Comp: SiTensorflow, label: "TensorFlow", color: "#FF6F00" },
};

// Liste ordonnée pour la bande statique de la Landing Page — vitrine
// complète de toutes les catégories de formations, indépendante de
// formation.technologies (qui reste utilisé uniquement sur FormationDetail,
// voir Feature 3B). Adobe Suite, Microsoft, Power BI, SonarQube et VS Code
// omis (voir note en tête de fichier).
export const LANDING_MARQUEE_SLUGS = [
  // MERN stack
  "mongodb", "express", "react", "nodejs", "nextjs",
  // Angular + Spring Boot
  "angular", "springboot",
  // Flutter
  "flutter",
  // JavaScript / HTML5 / CSS3
  "javascript", "html", "css3", "typescript",
  // IA / Chatbot / Recommandation
  "openai", "tensorflow",
  // Cybersécurité
  "kalilinux",
  // IoT
  "arduino", "espressif", "mqtt",
  // BI / Business Intelligence
  "sql",
  // DevOps
  "docker", "kubernetes", "jenkins", "githubactions", "ansible", "terraform", "argocd",
  // Marketing Digital
  "wordpress", "googleads",
  // Autres technos déjà couvertes
  "php", "python", "vue",
];

export function getTechLogo(slug) {
  return TECH_LOGOS[slug] || null;
}
