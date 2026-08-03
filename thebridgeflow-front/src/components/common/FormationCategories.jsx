import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { FORMATION_CATEGORIES } from "../../constants/formationCategories.js";
import "./FormationCategories.css";

/**
 * Rangée de catégories de formations (cercles-icônes). Chaque catégorie
 * renvoie vers /formations (page Formations n'a pas encore de filtre par
 * catégorie — à réutiliser ici dès qu'il existera). `formations` sert
 * uniquement à calculer les compteurs affichés sous chaque icône.
 */
export default function FormationCategories({ formations }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const [thumb, setThumb] = useState({ ratio: 1, offset: 0 });
  const [hasOverflow, setHasOverflow] = useState(false);

  const counts = useMemo(() => {
    const map = {};
    FORMATION_CATEGORIES.forEach((cat) => {
      map[cat.key] = formations.filter((f) => cat.slugs.includes(f.slug)).length;
    });
    return map;
  }, [formations]);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const overflow = scrollWidth > clientWidth + 4;
    setHasOverflow(overflow);
    if (!overflow) { setThumb({ ratio: 1, offset: 0 }); return; }
    const ratio = clientWidth / scrollWidth;
    const maxScroll = scrollWidth - clientWidth;
    setThumb({ ratio, offset: maxScroll > 0 ? scrollLeft / maxScroll : 0 });
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState, formations]);

  const scrollByStep = (dir) => {
    trackRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  return (
    <section className="fcat-section">
      <div className="fcat-section__inner">
        <div className="fcat-header">
          <h2 className="fcat-header__title">{t("landing.categoriesTitle")}</h2>
          <p className="fcat-header__sub">{t("landing.categoriesSub")}</p>
        </div>

        {hasOverflow && (
          <div className="fcat-progress" aria-hidden="true">
            <div
              className="fcat-progress__thumb"
              style={{ width: `${thumb.ratio * 100}%`, left: `${thumb.offset * (100 - thumb.ratio * 100)}%` }}
            />
          </div>
        )}

        <div className="fcat-row">
          {hasOverflow && (
            <button type="button" className="fcat-arrow" onClick={() => scrollByStep(-1)} aria-label={t("testimonials.prev")}>
              <FiChevronLeft size={18} />
            </button>
          )}

          <div className="fcat-track" ref={trackRef} onScroll={updateScrollState}>
            {FORMATION_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  to="/formations"
                  key={cat.key}
                  className="fcat-item"
                  aria-label={t(cat.labelKey)}
                >
                  <span className="fcat-item__sparkle fcat-item__sparkle--1" aria-hidden="true">✦</span>
                  <span className="fcat-item__sparkle fcat-item__sparkle--2" aria-hidden="true">✦</span>
                  <span className="fcat-item__circle">
                    <Icon size={18} />
                  </span>
                  <span className="fcat-item__label">{t(cat.labelKey)}</span>
                  <span className="fcat-item__count">({counts[cat.key] ?? 0})</span>
                </Link>
              );
            })}
          </div>

          {hasOverflow && (
            <button type="button" className="fcat-arrow" onClick={() => scrollByStep(1)} aria-label={t("testimonials.next")}>
              <FiChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
