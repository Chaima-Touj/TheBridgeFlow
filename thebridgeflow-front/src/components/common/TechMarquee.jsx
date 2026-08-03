import { TECH_LOGOS, LANDING_MARQUEE_SLUGS, getTechLogo } from "../../constants/techLogos.js";
import "./TechMarquee.css";

/**
 * Bande de logos technos en défilement infini.
 * - Sans `technologies` (Landing) : affiche la liste statique complète.
 * - Avec `technologies` (FormationDetail) : n'affiche que les technos de
 *   cette formation ; si le tableau est vide, ne rend rien du tout.
 */
export default function TechMarquee({ technologies, title, subtitle }) {
  const slugs = technologies !== undefined
    ? technologies.filter((slug) => TECH_LOGOS[slug])
    : LANDING_MARQUEE_SLUGS;

  if (slugs.length === 0) return null;

  // Dupliqué une fois pour un loop CSS sans coupure visible (translateX(-50%)).
  const track = [...slugs, ...slugs];

  return (
    <section className="tm-section">
      <div className="tm-section__inner">
        {(title || subtitle) && (
          <div className="tm-header">
            {title && <h2 className="tm-header__title">{title}</h2>}
            {subtitle && <p className="tm-header__sub">{subtitle}</p>}
          </div>
        )}

        <div className="tm-marquee">
          <div className="tm-marquee__track">
            {track.map((slug, i) => {
              const logo = getTechLogo(slug);
              if (!logo) return null;
              return (
                <div className="tm-badge" key={`${slug}-${i}`} title={logo.label}>
                  {logo.type === "image" ? (
                    <img src={logo.source} alt={logo.label} className="tm-badge__img" loading="lazy" />
                  ) : (
                    <logo.Comp size={34} color={logo.color} className="tm-badge__icon" />
                  )}
                  <span className="tm-badge__label">{logo.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
