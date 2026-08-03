import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FiCalendar, FiUser, FiArrowRight } from "react-icons/fi";
import { newsService } from "../../services/news.service.js";
import "./NewsSection.css";

function formatDate(iso, lang) {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-TN" : lang === "en" ? "en-US" : "fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/**
 * Grille "Actualités & Blogs" — branchée sur GET /api/news (modèle Mongoose
 * News, gérée depuis le dashboard admin). `limit` restreint le nombre
 * d'articles retournés (déjà triés par date décroissante côté API) ; quand
 * il est fourni, un lien "Voir plus" vers /blog est affiché à la fin.
 */
export default function NewsSection({ lang = "fr", standalone = false, limit }) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let active = true;
    newsService.getAll(limit)
      .then(({ data }) => { if (active) setArticles(data); })
      .catch(() => { if (active) setArticles([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [limit]);

  if (!loading && articles.length === 0) return null;

  return (
    <section id="news" className={`news-section${standalone ? " news-section--standalone" : ""}`}>
      <div className="news-section__inner">
        <div className="news-header">
          <span className="news-header__badge">📰 {t("landing.newsBadge")}</span>
          <h2 className="news-header__title">{t("landing.newsTitle")}</h2>
          <p className="news-header__sub">{t("landing.newsSub")}</p>
        </div>

        {loading ? (
          <div className="news-grid">
            {Array.from({ length: limit || 3 }).map((_, i) => (
              <div key={i} className="news-card news-card--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <>
            <div className="news-grid">
              {articles.map((article) => (
                <article className="news-card" key={article._id}>
                  <div className="news-card__img-wrap">
                    <img
                      src={article.image}
                      alt=""
                      className="news-card__img"
                      loading="lazy"
                    />
                    <span className="news-card__category">{article.category}</span>
                  </div>
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <span className="news-card__meta-item"><FiCalendar size={13} /> {formatDate(article.publishedAt, lang)}</span>
                      <span className="news-card__meta-item"><FiUser size={13} /> {t("landing.newsByAuthor", { author: article.author })}</span>
                    </div>
                    <h3 className="news-card__title">{article.title}</h3>
                    {article.excerpt && <p className="news-card__excerpt">{article.excerpt}</p>}
                  </div>
                </article>
              ))}
            </div>

            {limit != null && (
              <div className="news-view-more-wrap">
                <Link to="/blog" className="btn btn-outline news-view-more">
                  {t("landing.newsViewMore")} <FiArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
