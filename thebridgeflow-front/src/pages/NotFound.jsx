import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiHome } from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import "./FormationsPage.css";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="fp-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge">404</span>
          <h1 className="fp-hero__title">{t("notFound.title")}</h1>
          <p className="fp-hero__subtitle">{t("notFound.subtitle")}</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: "1.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <FiHome size={16} /> {t("notFound.backHome")}
          </Link>
        </div>
      </section>
    </div>
  );
}
