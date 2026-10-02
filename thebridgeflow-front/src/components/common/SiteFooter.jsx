import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiFacebook, FiLinkedin, FiInstagram, FiYoutube,
  FiMapPin, FiPhone, FiMail,
} from "react-icons/fi";
import { TbBrandWhatsapp } from "react-icons/tb";
import { PHONE_NUMBER } from "../../utils/phoneDisplay.jsx";
import { buildWhatsAppLink } from "../../utils/whatsapp.js";
import { scrollToSection } from "../../utils/scrollToSection.js";
import "./SiteFooter.css";

export default function SiteFooter() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSectionClick = (sectionId) => (event) => {
    event.preventDefault();
    if (location.pathname === "/") {
      scrollToSection(sectionId);
    } else {
      navigate("/", { state: { scrollTo: sectionId } });
    }
  };

  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__brand">
          <Link to="/" className="lp-nav__logo" style={{ color: "#94A3B8" }}>
            <img src="/favicon.png" alt="Logo" className="lp-nav__logo-icon" />
            <span>TheBridge<span className="lp-accent">Flow</span></span>
          </Link>
          <p className="lp-footer__tagline">{t("landing.footerTagline")}</p>
          <div className="lp-footer__socials">
            <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FiFacebook size={17} /></a>
            <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FiLinkedin size={17} /></a>
            <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FiInstagram size={17} /></a>
            <a href="https://www.youtube.com/@9antra.tn_the_bridge" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><FiYoutube size={17} /></a>
            <a href={buildWhatsAppLink(t("common.whatsappPrefill"))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><TbBrandWhatsapp size={18} /></a>
          </div>
        </div>

        <div className="lp-footer__col">
          <h4>{t("landing.footerNav")}</h4>
          <a href="#hero" onClick={handleSectionClick("hero")}>{t("landing.footerHome")}</a>
          <a href="#about" onClick={handleSectionClick("about")}>{t("landing.footerAbout")}</a>
          <a href="#features" onClick={handleSectionClick("features")}>{t("landing.footerFeatures")}</a>
          <Link to="/tarifs">{t("landing.footerPricing")}</Link>
          <Link to="/conditions">{t("landing.footerTerms")}</Link>
        </div>

        <div className="lp-footer__col">
          <h4>{t("landing.footerResources")}</h4>
          <a href="https://www.instagram.com/p/DZZuwmXggHz/?img_index=1&igsh=MWs3Y3pxcnpsZ3IzOQ%3D%3D" target="_blank" rel="noopener noreferrer">{t("landing.footerFAQ")}</a>
          <Link to="/blog">{t("landing.footerNews")}</Link>
          <Link to="/guides">{t("landing.footerGuides")}</Link>
          <Link to="/aide">{t("landing.footerHelp")}</Link>
        </div>

        <div className="lp-footer__col">
          <h4>{t("landing.footerLegal")}</h4>
          <Link to="/mentions-legales">{t("landing.footerMentions")}</Link>
          <Link to="/confidentialite">{t("landing.footerPrivacy")}</Link>
          <Link to="/cgu">{t("landing.footerCGU")}</Link>
        </div>

        <div className="lp-footer__col">
          <h4>{t("nav.contact")}</h4>
          <span><FiMapPin size={13} /> Lac 1, Tunis — Level 1</span>
          <span><FiMapPin size={13} /> Sahloul, Sousse — Rockets</span>
          <span><FiPhone size={13} /> <span dir="ltr">{PHONE_NUMBER}</span></span>
          <span><FiMail size={13} /> contact@9antra.tn</span>
        </div>
      </div>

      <div className="lp-footer__bottom">
        © 2026 TheBridgeFlow. {t("landing.copyright")}.
      </div>
    </footer>
  );
}
