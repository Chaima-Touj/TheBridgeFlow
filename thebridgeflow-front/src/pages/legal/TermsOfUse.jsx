import { useTranslation } from "react-i18next";
import { FiTool } from "react-icons/fi";
import SiteNavbar from "../../components/common/SiteNavbar.jsx";
import "../FormationsPage.css";
import "./LegalPage.css";

export default function TermsOfUse() {
  const { t } = useTranslation();

  return (
    <div className="fp-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge"><FiTool size={14} /> {t("legal.badge")}</span>
          <h1 className="fp-hero__title">{t("cgu.title")}</h1>
        </div>
      </section>

      <div className="legal-content">
        <p className="legal-content__intro">{t("cgu.intro1")}</p>
        <p>{t("cgu.intro2")}</p>

        <h2>{t("cgu.accountsTitle")}</h2>
        <p>{t("cgu.accountsText1")}</p>
        <p>{t("cgu.accountsText2")}</p>
        <p>{t("cgu.accountsText3")}</p>

        <h2>{t("cgu.linksTitle")}</h2>
        <p>{t("cgu.linksText1")}</p>
        <p>{t("cgu.linksText2")}</p>
        <p>{t("cgu.linksText3")}</p>

        <h2>{t("cgu.terminationTitle")}</h2>
        <p>{t("cgu.terminationText1")}</p>
        <p>{t("cgu.terminationText2")}</p>
        <p>{t("cgu.terminationText3")}</p>
        <p>{t("cgu.terminationText4")}</p>

        <p className="legal-content__updated">{t("legal.updated")}</p>
      </div>
    </div>
  );
}
