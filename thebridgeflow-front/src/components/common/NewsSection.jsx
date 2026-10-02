import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ImageOff, UserRound } from "lucide-react";
import { newsService } from "../../services/news.service.js";
import { resolveDriveThumbnailProxyUrl, resolveDriveUrl } from "../../constants/videoUrls.js";
import "./NewsSection.css";

function formatDate(iso, lang) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(
    lang === "ar" ? "ar-TN" : lang === "en" ? "en-US" : "fr-FR",
    { day: "numeric", month: "short", year: "numeric" }
  ).format(date);
}

function NewsCard({ article, lang, authorLabel, readLabel, standalone }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = resolveDriveThumbnailProxyUrl(article.image) || resolveDriveUrl(article.image, "image");
  const Heading = standalone ? "h2" : "h3";

  return (
    <article className="news-card">
      <Link
        className="news-card__link"
        to={`/blog/${article._id}`}
        aria-label={`${readLabel}: ${article.title}`}
      >
        <div className="news-card__img-wrap">
          {article.image && !imageFailed
            ? <img
                src={imageUrl}
                alt=""
                className="news-card__img"
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            : <div className="news-card__image-fallback" aria-hidden="true"><ImageOff size={30} /></div>}
          <span className="news-card__category">{article.category}</span>
        </div>
        <div className="news-card__body">
          <div className="news-card__meta">
            <span className="news-card__meta-item">
              <CalendarDays size={14} aria-hidden="true" />
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, lang)}</time>
            </span>
            <span className="news-card__meta-item">
              <UserRound size={14} aria-hidden="true" />
              {authorLabel}
            </span>
          </div>
          <Heading className="news-card__title">{article.title}</Heading>
          {article.excerpt && <p className="news-card__excerpt">{article.excerpt}</p>}
          <span className="news-card__read-more">
            {readLabel}<ArrowRight size={16} aria-hidden="true" />
          </span>
        </div>
      </Link>
    </article>
  );
}

/**
 * Grille Actualités — branchée sur GET /api/news (modèle Mongoose
 * News, gérée depuis le dashboard admin). `limit` restreint le nombre
 * d'articles retournés (déjà triés par date décroissante côté API) ; quand
 * il est fourni, un lien vers la page complète est affiché à la fin.
 */
export default function NewsSection({ lang = "fr", standalone = false, limit }) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    newsService.getAll(limit)
      .then(({ data }) => { if (active) { setArticles(data); setError(false); } })
      .catch(() => { if (active) { setArticles([]); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [limit]);

  if (!standalone && !loading && articles.length === 0) return null;

  return (
    <section id="news" className={`news-section${standalone ? " news-section--standalone" : ""}`}>
      <div className="news-section__inner">
        <div className="news-header">
          <span className="news-header__badge">📰 {t("news.badge")}</span>
          {standalone
            ? <h1 className="news-header__title">{t("news.title")}</h1>
            : <h2 className="news-header__title">{t("news.title")}</h2>}
          <p className="news-header__sub">{t("news.description")}</p>
        </div>

        {loading ? (
          <div className="news-grid" aria-label={t("news.loading")}>
            {Array.from({ length: limit || 3 }).map((_, i) => (
              <div key={i} className="news-card news-card--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : error ? (
          standalone && <p className="news-state news-state--error" role="alert">{t("news.loadError")}</p>
        ) : articles.length === 0 ? (
          standalone && <p className="news-state">{t("news.empty")}</p>
        ) : (
          <>
            <div className="news-grid">
              {articles.map((article) => (
                <NewsCard
                  key={article._id}
                  article={article}
                  lang={lang}
                  authorLabel={t("landing.newsByAuthor", { author: article.author })}
                  readLabel={t("news.readArticle")}
                  standalone={standalone}
                />
              ))}
            </div>

            {limit != null && (
              <div className="news-view-more-wrap">
                <Link to="/blog" className="btn btn-outline news-view-more">
                  {t("landing.newsViewMore")} <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
