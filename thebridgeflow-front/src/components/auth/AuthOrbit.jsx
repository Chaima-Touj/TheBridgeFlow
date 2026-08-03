import { TECH_LOGOS } from "../../constants/techLogos.js";
import "./AuthOrbit.css";

// Icônes technos affichées en orbite — sous-ensemble du dictionnaire partagé
// techLogos.js (mêmes technos que la stack du projet + celles déjà utilisées
// par TechMarquee/FormationDetail), réparties sur 4 anneaux de rayon croissant
// pour rester lisible. Chaque anneau a ses délais répartis uniformément sur sa
// durée (duration / nb d'icônes) pour un espacement régulier au démarrage.
const ORBIT_TECHS = [
  // Anneau 1 (le plus intérieur) — noyau serveur/scripting
  { slug: "javascript", radius: 62,  size: 32, duration: 12, delay: 0,     reverse: true },
  { slug: "python",     radius: 62,  size: 32, duration: 12, delay: -4,    reverse: true },
  { slug: "express",    radius: 62,  size: 32, duration: 12, delay: -8,    reverse: true },

  // Anneau 2 — stack MERN, mise en avant (icônes plus grandes)
  { slug: "react",      radius: 104, size: 42, duration: 17, delay: 0,   reverse: false },
  { slug: "nodejs",     radius: 104, size: 42, duration: 17, delay: -5.66, reverse: false },
  { slug: "mongodb",    radius: 104, size: 42, duration: 17, delay: -11.33, reverse: false },

  // Anneau 3 — front-end / langages
  { slug: "html",       radius: 142, size: 30, duration: 22, delay: 0,    reverse: false },
  { slug: "css3",       radius: 142, size: 30, duration: 22, delay: -5.5, reverse: false },
  { slug: "typescript", radius: 142, size: 30, duration: 22, delay: -11,  reverse: false },
  { slug: "angular",    radius: 142, size: 30, duration: 22, delay: -16.5, reverse: false },

  // Anneau 4 (le plus extérieur) — mobile / infra
  { slug: "flutter",    radius: 176, size: 28, duration: 28, delay: 0,   reverse: true },
  { slug: "docker",     radius: 176, size: 28, duration: 28, delay: -14, reverse: true },
];

const RIPPLE_COUNT = 5;

/**
 * Fond animé du panneau gauche Login/Register : anneaux Ripple pulsants +
 * icônes technos en orbite. Purement décoratif (aria-hidden), en CSS pur —
 * remplace les anciennes <div class="auth-shape--*"> statiques.
 */
export default function AuthOrbit() {
  return (
    <div className="auth-orbit" aria-hidden="true">
      {/* Contenu à taille fixe (px), remis à l'échelle en un bloc via
          transform:scale() sur les panneaux plus étroits (cf. media queries
          dans AuthOrbit.css) plutôt que de recalculer chaque rayon. */}
      <div className="auth-orbit__scaler">
        <div className="auth-orbit__ripple">
          {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
            <span
              key={i}
              className="auth-orbit__ripple-ring"
              style={{
                "--ripple-size": `${140 + i * 90}px`,
                "--ripple-delay": `${i * 0.35}s`,
              }}
            />
          ))}
        </div>

        {ORBIT_TECHS.map(({ slug, radius, size, duration, delay, reverse }) => {
          const logo = TECH_LOGOS[slug];
          if (!logo) return null;
          return (
            <span
              key={slug}
              className={`auth-orbit__icon${reverse ? " auth-orbit__icon--reverse" : ""}`}
              style={{
                "--orbit-radius": `${radius}px`,
                "--orbit-size": `${size}px`,
                "--orbit-duration": `${duration}s`,
                "--orbit-delay": `${delay}s`,
              }}
              title={logo.label}
            >
              <logo.Comp size={size * 0.5} color={logo.color} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
