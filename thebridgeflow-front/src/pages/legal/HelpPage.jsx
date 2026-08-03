import { useTranslation } from "react-i18next";
import { FiMail } from "react-icons/fi";
import { TbBrandWhatsapp } from "react-icons/tb";
import SiteNavbar from "../../components/common/SiteNavbar.jsx";
import { withIsolatedPhone } from "../../utils/phoneDisplay.jsx";
import { buildWhatsAppLink } from "../../utils/whatsapp.js";
import "../FormationsPage.css";
import "./LegalPage.css";

const FAQ_KEYS = ["faq1", "faq2", "faq3", "faq4"];

export default function HelpPage() {
  const { t } = useTranslation();

  return (
    <div className="fp-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge">🆘 {t("aide.badge")}</span>
          <h1 className="fp-hero__title">{t("aide.title")}</h1>
          <p className="fp-hero__subtitle">{t("aide.subtitle")}</p>
        </div>
      </section>

      <div className="help-content">
        <div className="help-faq">
          {FAQ_KEYS.map((key) => (
            <details key={key}>
              <summary>{t(`aide.${key}.q`)}</summary>
              <p>{withIsolatedPhone(t(`aide.${key}.a`))}</p>
            </details>
          ))}
        </div>

        <div className="help-contact">
          <h2>{t("aide.contactTitle")}</h2>
          <p>{t("aide.contactSub")}</p>
          <div className="help-contact__actions">
            <a href="mailto:contact@9antra.tn" className="btn btn-outline">
              <FiMail size={16} /> contact@9antra.tn
            </a>
            <a href={buildWhatsAppLink(t("common.whatsappPrefill"))} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <TbBrandWhatsapp size={17} /> {t("aide.whatsapp")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
