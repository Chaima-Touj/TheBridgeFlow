import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarDays, ImageOff, UserRound } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import { newsService } from "../services/news.service.js";
import { useDocumentMeta, truncateForSEO } from "../hooks/useDocumentMeta.js";
import { resolveDriveThumbnailProxyUrl, resolveDriveUrl } from "../constants/videoUrls.js";
import "./NewsDetailPage.css";

function formatDate(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const locale = language.startsWith("ar") ? "ar-TN" : language.startsWith("en") ? "en-US" : "fr-FR";
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
}

function NewsArticleImage({ article }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = resolveDriveThumbnailProxyUrl(article.image) || resolveDriveUrl(article.image, "image");

  return article.image && !failed
    ? <img
        className="news-detail__image"
        src={imageUrl}
        alt={article.title}
        onError={() => setFailed(true)}
      />
    : <div className="news-detail__image-fallback" aria-label={article.title}>
        <ImageOff size={42} aria-hidden="true" />
      </div>;
}

export default function NewsDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const isLoading = loading || loadedId !== id;

  useDocumentMeta({
    title: article ? `${article.title} — ${t("news.title")} | TheBridgeFlow` : t("news.seoTitle"),
    description: article
      ? truncateForSEO(article.excerpt || article.content || article.title)
      : t("news.seoDescription"),
  });

  useEffect(() => {
    let active = true;
    newsService.getOne(id)
      .then(({ data }) => {
        if (!active) return;
        setArticle(data);
        setErrorKey("");
      })
      .catch((err) => {
        if (!active) return;
        setArticle(null);
        setErrorKey(err.response?.status === 404 ? "news.notFound" : "news.loadError");
      })
      .finally(() => {
        if (!active) return;
        setLoadedId(id);
        setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  return (
    <div className="news-detail-page">
      <SiteNavbar />
      <main className="news-detail-main">
        {isLoading ? (
          <div className="news-detail__state" role="status">
            <Loader size="lg" label={t("news.loading")} />
          </div>
        ) : errorKey ? (
          <section className="news-detail__state news-detail__state--message" role="alert">
            <p>{t(errorKey)}</p>
            <Link to="/blog" className="news-detail__back">
              <ArrowLeft size={17} aria-hidden="true" />{t("news.back")}
            </Link>
          </section>
        ) : article && (
          <article className="news-detail">
            <NewsArticleImage key={article._id} article={article} />
            <div className="news-detail__content">
              <Link to="/blog" className="news-detail__back">
                <ArrowLeft size={17} aria-hidden="true" />{t("news.back")}
              </Link>
              <span className="news-detail__category">{article.category}</span>
              <h1>{article.title}</h1>
              <div className="news-detail__meta">
                <span><CalendarDays size={17} aria-hidden="true" />
                  <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, i18n.language)}</time>
                </span>
                <span><UserRound size={17} aria-hidden="true" />{t("landing.newsByAuthor", { author: article.author })}</span>
              </div>
              {article.excerpt && article.content && <p className="news-detail__excerpt">{article.excerpt}</p>}
              {(article.content || article.excerpt) && (
                <div className="news-detail__body">{article.content || article.excerpt}</div>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
