import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FiAward, FiBookOpen, FiMessageCircle, FiTarget, FiTrendingUp, FiUsers } from "react-icons/fi";
import { useLang } from "../../context/langContext.js";
import "../../pages/LandingPage.css";

export default function AboutSection({ id = "about" }) {
  const { t } = useTranslation();
  const { lang } = useLang();

  const cards = [
    { title: t("landing.aboutCard1Title"), desc: t("landing.aboutCard1Desc"), icon: <FiUsers size={22} />, color: "#2563EB" },
    { title: t("landing.aboutCard2Title"), desc: t("landing.aboutCard2Desc"), icon: <FiMessageCircle size={22} />, color: "#10B981" },
    { title: t("landing.aboutCard3Title"), desc: t("landing.aboutCard3Desc"), icon: <FiAward size={22} />, color: "#F59E0B" },
    { title: t("landing.aboutCard4Title"), desc: t("landing.aboutCard4Desc"), icon: <FiBookOpen size={22} />, color: "#8B5CF6" },
  ];

  return (
    <section id={id} className="lp-about">
      <div className="lp-about__inner">
        <motion.div
          className="lp-about__left"
          initial={{ opacity: 0, x: lang === "ar" ? 40 : -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <span className="lp-section-badge">{t("landing.aboutBadge")}</span>
          <h2 className="lp-about__title">{t("landing.aboutTitle")}</h2>
          <p className="lp-about__sub">{t("landing.aboutSub")}</p>

          <div className="lp-about__pillars">
            <div className="lp-pillar">
              <div className="lp-pillar__icon"><FiTarget size={18} /></div>
              <div>
                <div className="lp-pillar__label">{t("landing.missionLabel")}</div>
                <div className="lp-pillar__text">{t("landing.missionText")}</div>
              </div>
            </div>
            <div className="lp-pillar">
              <div className="lp-pillar__icon lp-pillar__icon--green"><FiTrendingUp size={18} /></div>
              <div>
                <div className="lp-pillar__label">{t("landing.visionLabel")}</div>
                <div className="lp-pillar__text">{t("landing.visionText")}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="lp-about__right">
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              className="lp-about-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
            >
              <div className="lp-about-card__icon" style={{ background: `${card.color}18`, color: card.color }}>
                {card.icon}
              </div>
              <div>
                <div className="lp-about-card__title">{card.title}</div>
                <div className="lp-about-card__desc">{card.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
