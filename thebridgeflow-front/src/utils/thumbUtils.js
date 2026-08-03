/* ── Miniatures de cours 16:9 — /public/images/course-placeholders/ */

/**
 * Détection par titre de semaine (prioritaire) :
 * permet d'afficher React pour une semaine "Composants React" dans une formation MERN,
 * Node.js pour "API REST & JWT", MongoDB pour "Base de données & Mongoose", etc.
 */
const WEEK_TECH = [
  {
    keys: ["react", "frontend", "composant", "component", "routing", "routage",
           "template", "hooks", "localstorage", "sessionstorage", "spa"],
    file: "react",
  },
  {
    keys: ["node", "express", "backend", "api", "crud", "jwt",
           "authentication", "authentification", "middleware", "serveur"],
    file: "nodejs",
  },
  {
    keys: ["mongodb", "base de données", "database", "collection",
           "document", "mongoose", "bdd", "nosql"],
    file: "mongodb",
  },
  { keys: ["javascript", "js vanilla"], file: "javascript" },
  { keys: ["typescript"],               file: "typescript" },
  { keys: ["docker", "devops", "ci/cd", "cicd", "pipeline", "kubernetes"], file: "docker" },
  { keys: ["html", "css", "scss", "sass", "tailwind"], file: "html" },
  { keys: ["vue", "nuxt"],              file: "vue"        },
  { keys: ["angular"],                  file: "angular"    },
  { keys: ["php", "laravel", "symfony"],file: "php"        },
  { keys: ["python", "django", "flask"],file: "python"     },
];

/**
 * Détection par titre/slug de formation (fallback formation-level).
 */
const FORMATION_TECH = [
  { keys: ["mern", "react"],                      src: "/images/course-placeholders/react.png"      },
  { keys: ["node"],                               src: "/images/course-placeholders/nodejs.png"     },
  { keys: ["mongo"],                              src: "/images/course-placeholders/mongodb.png"    },
  { keys: ["javascript", "js"],                  src: "/images/course-placeholders/javascript.png" },
  { keys: ["typescript", "ts"],                  src: "/images/course-placeholders/typescript.png" },
  { keys: ["python"],                             src: "/images/course-placeholders/python.png"     },
  { keys: ["devops", "docker", "cicd", "ci/cd"], src: "/images/course-placeholders/docker.png"     },
  { keys: ["html", "css"],                        src: "/images/course-placeholders/html.png"       },
  { keys: ["vue", "nuxt"],                        src: "/images/course-placeholders/vue.png"        },
  { keys: ["angular"],                            src: "/images/course-placeholders/angular.png"    },
  { keys: ["php", "laravel"],                     src: "/images/course-placeholders/php.png"        },
  { keys: ["ai", "intelligence", "machine"],      src: "/images/ai-thumbs/AI2-form-month1-thumb.jpg" },
  { keys: ["iot", "esp32", "arduino", "objets connectés", "objets connectes"], src: "/images/iot-thumbs/form-iot-sem1-thumb.jpg" },
  // Pas d'icône PNG dédiée pour cyber-security dans course-placeholders/ —
  // même convention que ai/iot ci-dessus : repli sur une vraie miniature
  // de la formation plutôt qu'une icône générique inventée.
  { keys: ["cyber", "security", "sécurité", "pentest", "hacking"], src: "/images/cyber-thumbs/form-cyber-sem1-thumb.jpg" },
];

export const DEFAULT_THUMB = { src: "/images/course-placeholders/default.png", bg: null };

function _ytId(url = "") {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&\s]{11})/);
  return m ? m[1] : null;
}

/** Retourne l'URL de la miniature correspondant au titre de la semaine. */
function _thumbByWeekTitle(title = "") {
  const lower = title.toLowerCase();
  const match = WEEK_TECH.find((t) => t.keys.some((k) => lower.includes(k)));
  // Par défaut : MERN Stack (react.png)
  return `/images/course-placeholders/${match ? match.file : "react"}.png`;
}

export function getFormationThumb(formation) {
  if (formation?.image) return { src: formation.image, bg: null };
  const key = `${formation?.slug ?? ""} ${formation?.title ?? ""}`.toLowerCase();
  const match = FORMATION_TECH.find((t) => t.keys.some((k) => key.includes(k)));
  return match ? { src: match.src, bg: null } : DEFAULT_THUMB;
}

export function getWeekThumb(week, formation) {
  // 1. Miniature explicite sur la semaine
  if (week?.thumbnail) return { src: week.thumbnail, bg: null };
  // 2. Miniature YouTube auto
  const id = _ytId(week?.videoUrl ?? "");
  if (id) return { src: `https://img.youtube.com/vi/${id}/mqdefault.jpg`, bg: null };
  // 3. Détection par titre de la semaine (plus précis que la formation)
  if (week?.content) return { src: _thumbByWeekTitle(week.content), bg: null };
  // 4. Fallback : détection par titre/slug de la formation
  return getFormationThumb(formation);
}
