import { useTranslation } from "react-i18next";
import { FiUserPlus, FiSend, FiClipboard, FiCalendar, FiBookOpen } from "react-icons/fi";
import SiteNavbar from "../../components/common/SiteNavbar.jsx";
import "../FormationsPage.css";
import "./LegalPage.css";

const GUIDE_KEYS = [
  { key: "guide1", icon: FiUserPlus },
  { key: "guide2", icon: FiSend },
  { key: "guide3", icon: FiClipboard },
  { key: "guide4", icon: FiCalendar },
  { key: "guide5", icon: FiBookOpen },
];

export default function GuidesPage() {
  const { t } = useTranslation();

  return (
    <div className="fp-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge">📘 {t("guides.badge")}</span>
          <h1 className="fp-hero__title">{t("guides.title")}</h1>
          <p className="fp-hero__subtitle">{t("guides.subtitle")}</p>
        </div>
      </section>

      <div className="guides-grid">
        {GUIDE_KEYS.map((g) => {
          const Icon = g.icon;
          const steps = t(`guides.${g.key}.steps`, { returnObjects: true });
          return (
            <div key={g.key} className="guide-card">
              <div className="guide-card__icon"><Icon size={20} /></div>
              <h3 className="guide-card__title">{t(`guides.${g.key}.title`)}</h3>
              <ol className="guide-card__steps">
                {steps.map((s, i) => (
                  <li key={i}>
                    <span className="guide-card__step-num">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
