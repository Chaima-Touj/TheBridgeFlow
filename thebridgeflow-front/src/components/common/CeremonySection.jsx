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

const EASE_LAND = [0.16, 1, 0.3, 1];

/**
 * Section promo "Cérémonie" sur la Landing Page — même pattern que les
 * autres sections dédiées (NewsSection.jsx, TechMarquee.jsx) : composant
 * autonome avec sa propre CSS, monté directement dans LandingPage.jsx.
 * Pas de fetch ici (contrairement à NewsSection) : texte + CTA statiques,
 * seul le QR code est généré dynamiquement (voir ceremonyUrl).
 *
 * Layout : colonne unique centrée (badge → titre → sous-titre → étapes →
 * CTA → carte QR). Animation d'entrée en cascade top→bottom (fade +
 * translateY vers le haut) plutôt qu'un glissement latéral, qui n'a plus de
 * sens dans un layout à une colonne — orchestrée via des variants Framer
 * Motion (staggerChildren sur le conteneur), pas un whileInView par élément.
 * Le titre a son propre sous-stagger mot par mot (variants imbriqués,
 * propagation Framer Motion standard).
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
  const titleWords = t("landing.ceremonyTitle").split(" ");

  // ── Orchestration de la cascade ──────────────────────────────────────────
  // prefers-reduced-motion : les blocs restent en fondu simple (pas de
  // translateY) et le stagger est neutralisé (délais à 0) — cascade quasi
  // instantanée plutôt que supprimée, pour éviter un flash de contenu.
  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.14, delayChildren: reduceMotion ? 0 : 0.05 },
    },
  };
  const itemVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_LAND } },
  };
  const qrCardVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.94 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE_LAND } },
  };
  const titleContainerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } },
  };
  const titleWordVariants = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, rotateX: -55 },
    visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.5, ease: EASE_LAND } },
  };

  return (
    <section id="ceremonie" className="ceremony-section">
      <div className="ceremony-section__glow" aria-hidden="true" />
      <motion.div
        className="ceremony-section__inner"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.span className="lp-section-badge" variants={itemVariants}>
          <FiAward size={13} /> {t("landing.ceremonyBadge")}
        </motion.span>

        <motion.h2
          className="ceremony-section__title"
          variants={titleContainerVariants}
          style={{ perspective: 600 }}
        >
          {titleWords.map((word, i) => (
            <motion.span key={i} className="ceremony-section__title-word" variants={titleWordVariants}>
              {word}{i < titleWords.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </motion.h2>

        <motion.p className="lp-section-sub ceremony-section__sub" variants={itemVariants}>
          {t("landing.ceremonySub")}
        </motion.p>

        <motion.ul className="ceremony-section__steps" variants={itemVariants}>
          {steps.map(({ Icon, textKey }) => (
            <li key={textKey} className="ceremony-section__step">
              <span className="ceremony-section__step-icon"><Icon size={17} /></span>
              {t(textKey)}
            </li>
          ))}
        </motion.ul>

        <motion.div variants={itemVariants}>
          <Link to="/ceremonie" className="btn btn-primary btn-lg">
            {t("landing.ceremonyCta")} <FiArrowRight />
          </Link>
        </motion.div>

        <motion.div className="ceremony-section__right" variants={qrCardVariants}>
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
      </motion.div>
    </section>
  );
}
