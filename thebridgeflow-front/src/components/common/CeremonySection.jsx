import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { FiAward, FiArrowRight, FiUpload, FiUsers, FiTrendingUp } from "react-icons/fi";
import "./CeremonySection.css";

// Tilt 3D au survol — même mécanisme que .cp-card (CeremonyPage.jsx) :
// transform posé directement en JS (pas de setState) pour rester fluide,
// la transition CSS sur .ceremony-section__qr-card gère le lissage/retour à
// plat. Repris tel quel plutôt que réinventé, pour que les cartes Cérémonie
// se comportent de façon cohérente dans toute l'app.
const TILT_MAX_DEG = 6;
function handleCardTilt(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  const rotateY = (px - 0.5) * TILT_MAX_DEG * 2;
  const rotateX = (0.5 - py) * TILT_MAX_DEG * 2;
  card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;
}
function resetCardTilt(e) {
  e.currentTarget.style.transform = "";
}

/**
 * Section promo "Cérémonie" sur la Landing Page — même pattern que les
 * autres sections dédiées (NewsSection.jsx, TechMarquee.jsx) : composant
 * autonome avec sa propre CSS, monté directement dans LandingPage.jsx.
 * Pas de fetch ici (contrairement à NewsSection) : texte + CTA statiques,
 * seul le QR code est généré dynamiquement (voir ceremonyUrl).
 *
 * Animation d'entrée : le texte glisse depuis la gauche avec une légère
 * rotation qui se stabilise ("planeur qui se pose"), la carte QR suit
 * juste après depuis la droite avec un rotateY prononcé qui se redresse
 * ("objet qui atterrit en pivotant") — décalage volontaire (delay) pour un
 * effet de composition, pas un mouvement simultané plat. Springs plutôt que
 * des easings simples, comme CeremonyLeaderboard.jsx (CARD_TRANSITION) pour
 * un rendu physique/premium cohérent avec le reste de Cérémonie.
 */
export default function CeremonySection() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  // Déduite dynamiquement (pas de valeur codée en dur) — fonctionne quel que
  // soit l'environnement (localhost en dev, domaine réel en prod).
  const ceremonyUrl = `${window.location.origin}/ceremonie`;

  const steps = [
    { Icon: FiUpload,     textKey: "landing.ceremonyStep1" },
    { Icon: FiUsers,      textKey: "landing.ceremonyStep2" },
    { Icon: FiTrendingUp, textKey: "landing.ceremonyStep3" },
  ];

  // prefers-reduced-motion : un simple fondu remplace le glissement/pivot
  // (pas de translation ni de rotation 3D), le tilt au survol est neutralisé
  // plus bas (onMouseMove non attaché).
  const textInitial   = reduceMotion ? { opacity: 0 }                        : { opacity: 0, x: -70, rotate: -5 };
  const textTransition = reduceMotion ? { duration: 0.4 }                     : { type: "spring", stiffness: 45, damping: 12, mass: 1 };
  const qrInitial      = reduceMotion ? { opacity: 0 }                        : { opacity: 0, x: 70, rotateY: 50 };
  const qrTransition    = reduceMotion ? { duration: 0.4, delay: 0.15 }        : { type: "spring", stiffness: 48, damping: 11, mass: 1.1, delay: 0.18 };

  return (
    <section id="ceremonie" className="ceremony-section">
      <div className="ceremony-section__glow" aria-hidden="true" />
      <div className="ceremony-section__inner">
        <motion.div
          className="ceremony-section__left"
          initial={textInitial}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={textTransition}
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
          style={{ perspective: 1000 }}
          initial={qrInitial}
          whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={qrTransition}
        >
          <div
            className="ceremony-section__qr-card"
            onMouseMove={reduceMotion ? undefined : handleCardTilt}
            onMouseLeave={reduceMotion ? undefined : resetCardTilt}
          >
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
