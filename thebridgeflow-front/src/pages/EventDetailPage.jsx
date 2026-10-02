import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, MapPin, Users } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import Modal from "../components/common/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { eventsService } from "../services/events.service.js";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { resolveDriveUrl } from "../constants/videoUrls.js";
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
  const [participationModal, setParticipationModal] = useState("");
  const [registeredEventId, setRegisteredEventId] = useState(null);
  const participationConfirmed = registeredEventId === id;

  useDocumentMeta({ title: event ? `${event.title} — TheBridgeFlow` : t("events.title"), description: event?.description || t("events.description") });

  useEffect(() => {
    let active = true;
    eventsService.getOne(id)
      .then(({ data }) => { if (active) setEvent(data.event); })
      .catch(() => { if (active) setError(t("events.notFound")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, t]);

  useEffect(() => {
    if (user?.role !== "étudiant" || !event?.registrationRequired) return undefined;
    let active = true;
    eventsService.getMyRegistrations()
      .then(({ data }) => {
        if (!active) return;
        const registration = data.registrations?.find(
          (item) => item.event?._id === id && item.status === "registered"
        );
        setRegisteredEventId((current) => current === id ? current : registration ? id : null);
      })
      .catch((err) => {
        if (active) console.error("Failed to check current event participation", err);
      });
    return () => { active = false; };
  }, [event?.registrationRequired, id, user?.role]);

  const handleRegister = async () => {
    if (!user) {
      setParticipationModal("login");
      return;
    }
    if (user.role !== "étudiant") return;
    setSubmitting(true);
    setError("");
    try {
      await eventsService.register(id);
      setRegisteredEventId(id);
      setParticipationModal("success");
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
                {event.image && <img className="ev-detail__image" src={resolveDriveUrl(event.image, "image")} alt="" />}
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
                        ? <button className="btn btn-primary" type="button" onClick={handleRegister} disabled={submitting || participationConfirmed || (event.capacity !== null && event.registrationCount >= event.capacity)}>{submitting ? t("events.working") : participationConfirmed ? t("events.participationConfirmed") : t("events.participate")}</button>
                        : !user && <button className="btn btn-primary" type="button" onClick={handleRegister}>{t("events.participate")}</button>}
                    </div>
                  )}
                </div>
              </article>
            )}
      </main>
      {participationModal === "login" && (
        <Modal
          title={t("events.loginRequiredTitle")}
          onClose={() => setParticipationModal("")}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => setParticipationModal("")}>{t("common.cancel")}</button>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/login", { state: { from: `/events/${id}` } })}>{t("events.signIn")}</button>
          </>}
        >
          <p>{t("events.loginRequiredMessage")}</p>
        </Modal>
      )}
      {participationModal === "success" && (
        <Modal
          title={t("events.participationSuccessTitle")}
          onClose={() => setParticipationModal("")}
          footer={<button type="button" className="btn btn-primary" onClick={() => setParticipationModal("")}>{t("common.close")}</button>}
        >
          <p>{t("events.participationSuccessMessage")}</p>
        </Modal>
      )}
    </div>
  );
}
