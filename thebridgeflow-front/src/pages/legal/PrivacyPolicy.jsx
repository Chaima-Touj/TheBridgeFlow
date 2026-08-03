import { useTranslation } from "react-i18next";
import { FiTool } from "react-icons/fi";
import SiteNavbar from "../../components/common/SiteNavbar.jsx";
import "../FormationsPage.css";
import "./LegalPage.css";

export default function PrivacyPolicy() {
  const { t } = useTranslation();
  const useItems = t("confidentialite.useItems", { returnObjects: true });

  return (
    <div className="fp-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge"><FiTool size={14} /> {t("legal.badge")}</span>
          <h1 className="fp-hero__title">{t("confidentialite.title")}</h1>
        </div>
      </section>

      <div className="legal-content">
        <p className="legal-content__intro">{t("confidentialite.intro")}</p>

        <h2>{t("confidentialite.collectTitle")}</h2>

        <h3>{t("confidentialite.personalTitle")}</h3>
        <p>{t("confidentialite.personalText")}</p>

        <h3>{t("confidentialite.nonPersonalTitle")}</h3>
        <p>{t("confidentialite.nonPersonalText")}</p>

        <h3>{t("confidentialite.cookiesTitle")}</h3>
        <p>{t("confidentialite.cookiesText")}</p>

        <h2>{t("confidentialite.useTitle")}</h2>
        <p>{t("confidentialite.useIntro")}</p>
        <ul>
          {useItems.map((item) => (
            <li key={item.label}><strong>{item.label}</strong> {item.text}</li>
          ))}
        </ul>

        <h2>{t("confidentialite.protectTitle")}</h2>
        <p>{t("confidentialite.protectText")}</p>

        <p className="legal-content__updated">{t("legal.updated")}</p>
      </div>
    </div>
  );
}
