import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CalendarDays, Clock3, MapPin, Users, Video } from "lucide-react";
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
  return new Intl.DateTimeFormat(language, { dateStyle: "full", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

function formatTime(value, language, timezone) {
  return new Intl.DateTimeFormat(language, { timeStyle: "short", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { runWithPhone, phoneRequiredModal } = usePhoneRequirement();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [participationModal, setParticipationModal] = useState("");
  const [registrationDetails, setRegistrationDetails] = useState(null);
  const registrationLock = useRef(false);
  const participationConfirmed = user?.role === "étudiant" &&
    event?.registrationRequired &&
    registrationDetails?.eventId === id &&
    registrationDetails?.studentId === user?._id;
  const meetingUrl = participationConfirmed ? registrationDetails.meetingUrl : "";
  const capacityReached = Boolean(event && event.capacity !== null && event.capacity !== undefined &&
    event.registrationCount >= event.capacity);

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
        setRegistrationDetails(registration ? {
          eventId: id,
          studentId: user._id,
          meetingUrl: registration.event?.meetingUrl || "",
        } : null);
      })
      .catch((err) => {
        if (active) console.error("Failed to check current event participation", err);
      });
    return () => { active = false; };
  }, [event?.registrationRequired, id, user?._id, user?.role]);

  const submitRegistration = async () => {
    registrationLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      await eventsService.register(id);
      setRegistrationDetails({ eventId: id, studentId: user._id, meetingUrl: "" });
      setParticipationModal("success");
      try {
        const { data } = await eventsService.getMyRegistrations();
        const registration = data.registrations?.find(
          (item) => item.event?._id === id && item.status === "registered"
        );
        setRegistrationDetails(registration ? {
          eventId: id,
          studentId: user._id,
          meetingUrl: registration.event?.meetingUrl || "",
        } : { eventId: id, studentId: user._id, meetingUrl: "" });
      } catch (registrationError) {
        console.error("Failed to load event meeting link after registration", registrationError);
      }
    } catch (err) {
      setError(err.response?.data?.message || t("events.actionError"));
    } finally {
      registrationLock.current = false;
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!user) {
      setParticipationModal("login");
      return;
    }
    if (user.role !== "étudiant" || registrationLock.current || capacityReached || participationConfirmed) return;
    await runWithPhone(submitRegistration);
  };

  return (
    <div className="ev-public-page">
      <SiteNavbar />
      {phoneRequiredModal}
      <main className="ev-detail-wrap">
        {loading ? <div className="ev-loading"><Loader size="lg" /></div>
          : error && !event ? <p className="ev-state ev-error">{error}</p>
            : event && (
              <article className="ev-detail">
                {event.image && (
                  <div className="ev-detail__media">
                    <img className="ev-detail__image" src={resolveDriveThumbnailProxyUrl(event.image) || resolveDriveUrl(event.image, "image")} alt={event.title} />
                  </div>
                )}
                <div className="ev-detail__content">
                  <Link to="/events" className="ev-back">{t("events.back")}</Link>
                  <span className="ev-category">{event.category}</span>
                  <h1>{event.title}</h1>
                  <div className="ev-detail__facts">
                    <div className="ev-detail__fact">
                      <CalendarDays size={19} aria-hidden="true" />
                      <span><span className="ev-detail__fact-label">{t("events.dateLabel")}</span><time dateTime={event.startsAt}>{formatDate(event.startsAt, i18n.language, event.timezone)}</time></span>
                    </div>
                    <div className="ev-detail__fact">
                      <Clock3 size={19} aria-hidden="true" />
                      <span><span className="ev-detail__fact-label">{t("events.timeLabel")}</span><time dateTime={event.startsAt}>{formatTime(event.startsAt, i18n.language, event.timezone)}</time></span>
                    </div>
                    {event.location && (
                      <div className="ev-detail__fact">
                        <MapPin size={19} aria-hidden="true" />
                        <span><span className="ev-detail__fact-label">{t("events.locationLabel")}</span>{event.location}</span>
                      </div>
                    )}
                    <div className="ev-detail__fact">
                      <Video size={19} aria-hidden="true" />
                      <span>{t(`events.modes.${event.mode}`)}</span>
                    </div>
                    {event.capacity !== null && (
                      <div className="ev-detail__fact">
                        <Users size={19} aria-hidden="true" />
                        <span>{t("events.seats", { count: Math.max(0, event.capacity - event.registrationCount) })}</span>
                      </div>
                    )}
                  </div>
                  <section className="ev-detail__description-section">
                    <h2>{t("events.descriptionLabel")}</h2>
                    <p className="ev-detail__description">{event.description}</p>
                  </section>
                  {error && <p className="ev-form-error" role="alert">{error}</p>}
                  {event.status === "cancelled" && <p className="ev-form-error" role="status">{t("events.cancelledMessage")}</p>}
                  {event.status === "published" && event.registrationRequired === true &&
                    (participationConfirmed || new Date(event.startsAt) > new Date()) &&
                    (!user || user.role === "étudiant") && (
                    <section className="ev-registration-card" aria-labelledby="ev-registration-title">
                      <div className="ev-registration-card__copy">
                        <span className="ev-registration-card__eyebrow">{t("events.registrationEyebrow")}</span>
                        <h2 id="ev-registration-title">{participationConfirmed ? t("events.registeredTitle") : t("events.registrationTitle")}</h2>
                        <p>{participationConfirmed ? t("events.registeredDescription") : t("events.registrationDescription")}</p>
                      </div>
                      {participationConfirmed ? (
                        meetingUrl
                          ? <a className="btn btn-primary ev-participate-btn" href={meetingUrl} target="_blank" rel="noopener noreferrer">
                              <span>{t("events.joinMeeting")}</span><Video size={19} aria-hidden="true" />
                            </a>
                          : <p className="ev-registration-card__notice">{t("events.meetingComingSoon")}</p>
                      ) : (
                        <button
                          className="btn btn-primary ev-participate-btn"
                          type="button"
                          onClick={handleRegister}
                          disabled={submitting || capacityReached}
                        >
                          <span>{submitting ? t("events.working") : capacityReached ? t("events.full") : t("events.participate")}</span>
                          {capacityReached ? <Users size={19} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
                        </button>
                      )}
                    </section>
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
          footer={<button type="button" className="btn btn-primary" onClick={() => setParticipationModal("")}>{t("events.close")}</button>}
        >
          <p>{t("events.participationSuccessMessage")}</p>
        </Modal>
      )}
    </div>
  );
}
