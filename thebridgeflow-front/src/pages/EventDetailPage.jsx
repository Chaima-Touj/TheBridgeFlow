import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, MapPin, Users } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { eventsService } from "../services/events.service.js";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import "./Events.css";

function formatDate(value, language, timezone) {
  return new Intl.DateTimeFormat(language, { dateStyle: "full", timeStyle: "short", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useDocumentMeta({ title: event ? `${event.title} — TheBridgeFlow` : t("events.title"), description: event?.description || t("events.description") });

  useEffect(() => {
    let active = true;
    eventsService.getOne(id)
      .then(({ data }) => { if (active) setEvent(data.event); })
      .catch(() => { if (active) setError(t("events.notFound")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, t]);

  const handleRegister = async () => {
    if (!user) {
      navigate("/login", { state: { from: `/events/${id}` } });
      return;
    }
    if (user.role !== "étudiant") return;
    setSubmitting(true);
    setError("");
    try {
      await eventsService.register(id);
      navigate("/dashboard/student/events");
    } catch (err) {
      setError(err.response?.data?.message || t("events.actionError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ev-public-page">
      <SiteNavbar />
      <main className="ev-detail-wrap">
        {loading ? <div className="ev-loading"><Loader size="lg" /></div>
          : error && !event ? <p className="ev-state ev-error">{error}</p>
            : event && (
              <article className="ev-detail">
                {event.image && <img className="ev-detail__image" src={event.image} alt="" />}
                <div className="ev-detail__content">
                  <Link to="/events" className="ev-back">{t("events.back")}</Link>
                  <span className="ev-category">{event.category}</span>
                  <h1>{event.title}</h1>
                  <div className="ev-meta">
                    <span><CalendarDays size={16} />{formatDate(event.startsAt, i18n.language, event.timezone)}</span>
                    <span><Users size={16} />{t(`events.modes.${event.mode}`)}</span>
                    {event.location && <span><MapPin size={16} />{event.location}</span>}
                    {event.capacity !== null && <span><Users size={16} />{t("events.seats", { count: Math.max(0, event.capacity - event.registrationCount) })}</span>}
                  </div>
                  <p className="ev-detail__description">{event.description}</p>
                  {error && <p className="ev-form-error" role="alert">{error}</p>}
                  {event.status === "cancelled" && <p className="ev-form-error" role="status">{t("events.cancelledMessage")}</p>}
                  {event.status === "published" && event.registrationRequired && new Date(event.startsAt) > new Date() && (
                    <div className="ev-detail__actions">
                      {user?.role === "étudiant"
                        ? <button className="btn btn-primary" type="button" onClick={handleRegister} disabled={submitting || (event.capacity !== null && event.registrationCount >= event.capacity)}>{submitting ? t("events.working") : t("events.register")}</button>
                        : !user && <button className="btn btn-primary" type="button" onClick={handleRegister}>{t("events.loginToRegister")}</button>}
                    </div>
                  )}
                </div>
              </article>
            )}
      </main>
    </div>
  );
}
