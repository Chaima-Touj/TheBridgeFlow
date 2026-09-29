import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import "./FormationsPage.css";

export default function EventsPage() {
  const { t } = useTranslation();

  useDocumentMeta({
    title: `${t("events.title")} — TheBridgeFlow`,
    description: t("events.description"),
  });

  return (
    <div className="fp-page">
      <SiteNavbar />

      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge">
            <CalendarDays size={15} />
            {t("events.badge")}
          </span>
          <h1 className="fp-hero__title">{t("events.title")}</h1>
          <p className="fp-hero__subtitle">{t("events.description")}</p>
        </div>
      </section>

      <main className="fp-main">
        <section className="fp-card" aria-live="polite">
          <h2 className="fp-card__title">{t("events.previewTitle")}</h2>
          <p className="fp-card__desc">{t("events.previewDescription")}</p>
        </section>
      </main>
    </div>
  );
}
