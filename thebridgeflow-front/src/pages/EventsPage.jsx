import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, MapPin, Users } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { eventsService } from "../services/events.service.js";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import "./Events.css";

function formatDate(value, language, timezone) {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

export default function EventsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState("upcoming");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");

  useDocumentMeta({ title: `${t("events.title")} — TheBridgeFlow`, description: t("events.description") });

  useEffect(() => {
    let active = true;
    eventsService.getPublic(period)
      .then(({ data }) => { if (active) { setEvents(data.events || []); setError(false); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  const register = async (id) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (user.role !== "étudiant") return;
    setActionError("");
    try {
      await eventsService.register(id);
      navigate("/dashboard/student/events");
    } catch (err) {
      setActionError(err.response?.data?.message || t("events.actionError"));
    }
  };

  return (
    <div className="ev-public-page">
      <SiteNavbar />
      <section className="fp-hero">
        <div className="fp-hero__inner">
          <span className="fp-hero__badge"><CalendarDays size={15} />{t("events.badge")}</span>
          <h1 className="fp-hero__title">{t("events.title")}</h1>
          <p className="fp-hero__subtitle">{t("events.description")}</p>
        </div>
      </section>
      <main className="ev-main">
        <div className="ev-toolbar">
          <div className="ev-tabs" role="group" aria-label={t("events.periodLabel")}>
            {["upcoming", "past"].map((value) => (
              <button key={value} type="button" className={`ev-tab${period === value ? " is-active" : ""}`} onClick={() => { if (value !== period) { setLoading(true); setPeriod(value); } }}>
                {t(`events.period.${value}`)}
              </button>
            ))}
          </div>
          {actionError && <p className="ev-form-error" role="alert">{actionError}</p>}
        </div>
        {loading ? <div className="ev-loading"><Loader size="lg" /></div>
          : error ? <p className="ev-state ev-error">{t("events.loadError")}</p>
            : events.length === 0 ? <p className="ev-state">{t("events.empty")}</p>
              : <div className="ev-grid">
                {events.map((event) => (
                  <article className="ev-card" key={event._id}>
                    {event.image && <img className="ev-card__image" src={event.image} alt="" loading="lazy" />}
                    <div className="ev-card__body">
                      <span className="ev-category">{event.category}</span>
                      <h2 className="ev-card__title">{event.title}</h2>
                      <p className="ev-card__description">{event.description}</p>
                      <div className="ev-meta">
                        <span><CalendarDays size={15} />{formatDate(event.startsAt, i18n.language, event.timezone)}</span>
                        <span><Users size={15} />{t(`events.modes.${event.mode}`)}</span>
                        {event.location && <span><MapPin size={15} />{event.location}</span>}
                        {event.capacity !== null && <span><Users size={15} />{t("events.seats", { count: Math.max(0, event.capacity - event.registrationCount) })}</span>}
                      </div>
                      <div className="ev-card__actions">
                        <Link className="btn btn-ghost" to={`/events/${event._id}`}>{t("events.details")}</Link>
                        {event.registrationRequired && event.status === "published" && period === "upcoming" && user?.role === "étudiant" && (
                          <button type="button" className="btn btn-primary" onClick={() => register(event._id)}>{t("events.register")}</button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>}
      </main>
    </div>
  );
}
