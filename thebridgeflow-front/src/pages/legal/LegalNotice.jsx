import { useTranslation } from "react-i18next";
import { FiTool } from "react-icons/fi";
import SiteNavbar from "../../components/common/SiteNavbar.jsx";
import { PHONE_NUMBER, withIsolatedPhone } from "../../utils/phoneDisplay.jsx";
import "../FormationsPage.css";
import "./LegalPage.css";

export default function LegalNotice() {
  const { t } = useTranslation();

  return (
    <div className="fp-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge"><FiTool size={14} /> {t("legal.badge")}</span>
          <h1 className="fp-hero__title">{t("mentionsLegales.title")}</h1>
        </div>
      </section>

      <div className="legal-content">
        <h2>{t("mentionsLegales.editorTitle")}</h2>
        <p>{t("mentionsLegales.editorIntro")}</p>
        <ul>
          <li><strong>{t("mentionsLegales.addressLabel")}</strong> Lac 1, Tunis — Level 1</li>
          <li><strong>{t("mentionsLegales.phoneLabel")}</strong> <span dir="ltr">{PHONE_NUMBER}</span></li>
          <li><strong>{t("mentionsLegales.emailLabel")}</strong> contact@9antra.tn</li>
        </ul>

        <h2>{t("mentionsLegales.hostingTitle")}</h2>
        <p>{t("mentionsLegales.hostingText")}</p>

        <h2>{t("mentionsLegales.ipTitle")}</h2>
        <p>{t("mentionsLegales.ipText")}</p>

        <h2>{t("mentionsLegales.contactTitle")}</h2>
        <p>{withIsolatedPhone(t("mentionsLegales.contactText"))}</p>

        <p className="legal-content__updated">{t("legal.updated")}</p>
      </div>
    </div>
  );
}
