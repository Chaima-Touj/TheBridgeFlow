import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { FiAward, FiArrowRight, FiUpload, FiUsers, FiTrendingUp } from "react-icons/fi";
import "./CeremonySection.css";

/**
 * Section promo "Cérémonie" sur la Landing Page — même pattern que les
 * autres sections dédiées (NewsSection.jsx, TechMarquee.jsx) : composant
 * autonome avec sa propre CSS, monté directement dans LandingPage.jsx.
 * Pas de fetch ici (contrairement à NewsSection) : texte + CTA statiques,
 * seul le QR code est généré dynamiquement (voir qrCodeUrl).
 */
export default function CeremonySection() {
  const { t } = useTranslation();

  // Déduite dynamiquement (pas de valeur codée en dur) — fonctionne quel que
  // soit l'environnement (localhost en dev, domaine réel en prod).
  const ceremonyUrl = `${window.location.origin}/ceremonie`;

  const steps = [
    { Icon: FiUpload,     textKey: "landing.ceremonyStep1" },
    { Icon: FiUsers,      textKey: "landing.ceremonyStep2" },
    { Icon: FiTrendingUp, textKey: "landing.ceremonyStep3" },
  ];

  return (
    <section id="ceremonie" className="ceremony-section">
      <div className="ceremony-section__inner">
        <motion.div
          className="ceremony-section__left"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="lp-section-badge"><FiAward size={13} /> {t("landing.ceremonyBadge")}</span>
          <h2 className="lp-section-title">{t("landing.ceremonyTitle")}</h2>
          <p className="lp-section-sub">{t("landing.ceremonySub")}</p>

          <ul className="ceremony-section__steps">
            {steps.map(({ Icon, textKey }) => (
              <li key={textKey} className="ceremony-section__step">
                <span className="ceremony-section__step-icon"><Icon size={17} /></span>
                {t(textKey)}
              </li>
            ))}
          </ul>

          <Link to="/ceremonie" className="btn btn-primary btn-lg">
            {t("landing.ceremonyCta")} <FiArrowRight />
          </Link>
        </motion.div>

        <motion.div
          className="ceremony-section__right"
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          <div className="ceremony-section__qr-card">
            {/* Noir/blanc pur, non teinté par le thème — la priorité est la
                scannabilité réelle (imprimé, éclairage de salle), pas
                l'esthétique. Le thème s'exprime via la carte autour, pas
                les modules du QR code lui-même. */}
            <QRCodeSVG
              value={ceremonyUrl}
              size={148}
              level="M"
              marginSize={2}
              fgColor="#000000"
              bgColor="#FFFFFF"
              title={t("landing.ceremonyQrCaption")}
            />
            <p className="ceremony-section__qr-caption">{t("landing.ceremonyQrCaption")}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
