import SiteNavbar from "../components/common/SiteNavbar.jsx";
import NewsSection from "../components/common/NewsSection.jsx";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/langContext.js";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import "./FormationsPage.css";

export default function BlogPage() {
  const { lang } = useLang();
  const { t } = useTranslation();

  useDocumentMeta({
    title: t("news.seoTitle"),
    description: t("news.seoDescription"),
  });

  return (
    <div className="fp-page">
      <SiteNavbar />
      <NewsSection lang={lang} standalone />
    </div>
  );
}
