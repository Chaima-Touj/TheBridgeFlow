import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CalendarDays, ImageOff, MapPin, Users, Video } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import Modal from "../components/common/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { eventsService } from "../services/events.service.js";
import { usePhoneRequirement } from "../hooks/usePhoneRequirement.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { resolveDriveThumbnailProxyUrl, resolveDriveUrl } from "../constants/videoUrls.js";
import "./Events.css";

function formatDate(value, language, timezone) {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

function EventCardImage({ image, category }) {
  const [failed, setFailed] = useState(false);
  const src = resolveDriveThumbnailProxyUrl(image) || resolveDriveUrl(image, "image");

  return (
    <div className="ev-card__media">
      {image && !failed
        ? <img className="ev-card__image" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <div className="ev-card__image-fallback" aria-hidden="true"><ImageOff size={30} /></div>}
      <span className="ev-category">{category}</span>
    </div>
  );
}

export default function EventsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { runWithPhone, phoneRequiredModal } = usePhoneRequirement();
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState("upcoming");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [registeredEventIds, setRegisteredEventIds] = useState(() => new Set());
  const [registrationsLoadedUserId, setRegistrationsLoadedUserId] = useState(null);
  const [alreadyRegisteredModal, setAlreadyRegisteredModal] = useState(false);
  const registrationsLoaded = user?.role !== "étudiant" || registrationsLoadedUserId === user?._id;

  useDocumentMeta({ title: `${t("events.title")} — TheBridgeFlow`, description: t("events.description") });

  useEffect(() => {
    let active = true;
    eventsService.getPublic(period)
      .then(({ data }) => { if (active) { setEvents(data.events || []); setError(false); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);

  useEffect(() => {
    if (user?.role !== "étudiant") return undefined;
    let active = true;
    let eventIds = new Set();
    eventsService.getMyRegistrations()
      .then(({ data }) => {
        if (!active) return;
        eventIds = new Set(
          (data.registrations || [])
            .filter((registration) => registration.status === "registered")
            .map((registration) => registration.event?._id)
            .filter(Boolean)
        );
      })
      .catch((err) => {
        if (active) console.error("Failed to load current event registrations", err);
      })
      .finally(() => {
        if (!active) return;
        setRegisteredEventIds(eventIds);
        setRegistrationsLoadedUserId(user._id);
      });
    return () => { active = false; };
  }, [user?._id, user?.role]);

  const showAlreadyRegistered = () => {
    setActionError("");
    setAlreadyRegisteredModal(true);
  };

  const submitRegistration = async (id) => {
    setActionError("");
    try {
      await eventsService.register(id);
      navigate("/dashboard/student/events");
    } catch (err) {
      if (err.response?.data?.message?.includes("déjà inscrit")) {
        setRegisteredEventIds((current) => new Set(current).add(id));
        showAlreadyRegistered();
        return;
      }
      setActionError(err.response?.data?.message || t("events.actionError"));
    }
  };

  const register = async (id) => {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (user.role !== "étudiant") return;
    if (!registrationsLoaded) return;
    if (registeredEventIds.has(id)) {
      showAlreadyRegistered();
      return;
    }
    await runWithPhone(() => submitRegistration(id));
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
        {phoneRequiredModal}
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
                    <Link
                      className="ev-card__media-link"
                      to={`/events/${event._id}`}
                      aria-label={`${t("events.details")}: ${event.title}`}
                    >
                      <EventCardImage image={event.image} category={event.category} />
                    </Link>
                    <div className="ev-card__body">
                      <h2 className="ev-card__title">
                        <Link className="ev-card__title-link" to={`/events/${event._id}`}>{event.title}</Link>
                      </h2>
                      <div className="ev-card__date">
                        <CalendarDays size={18} aria-hidden="true" />
                        <time dateTime={event.startsAt}>{formatDate(event.startsAt, i18n.language, event.timezone)}</time>
                      </div>
                      <div className="ev-meta ev-card__meta">
                        <span><Video size={15} aria-hidden="true" />{t(`events.modes.${event.mode}`)}</span>
                        {event.location && <span><MapPin size={15} aria-hidden="true" />{event.location}</span>}
                        {event.capacity !== null && <span><Users size={15} aria-hidden="true" />{t("events.seats", { count: Math.max(0, event.capacity - event.registrationCount) })}</span>}
                      </div>
                      <p className="ev-card__description">{event.description}</p>
                      <div className="ev-card__actions">
                        <Link className="btn btn-primary ev-card__details" to={`/events/${event._id}`}>{t("events.details")}<ArrowUpRight size={16} aria-hidden="true" /></Link>
                        {event.registrationRequired && event.status === "published" && period === "upcoming" && user?.role === "étudiant" && (
                          <button type="button" className="btn btn-ghost" onClick={() => register(event._id)} disabled={!registrationsLoaded}>{t("events.register")}</button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>}
      </main>
      {alreadyRegisteredModal && (
        <Modal
          title={t("events.alreadyRegisteredTitle")}
          onClose={() => setAlreadyRegisteredModal(false)}
          footer={<button type="button" className="btn btn-primary" onClick={() => setAlreadyRegisteredModal(false)}>{t("events.close")}</button>}
        >
          <p>{t("events.alreadyRegisteredMessage")}</p>
        </Modal>
      )}
    </div>
  );
}
