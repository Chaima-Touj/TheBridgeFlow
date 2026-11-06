import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  MessageSquareText,
  Star,
  Users,
  Video,
} from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import Modal from "../components/common/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { eventsService } from "../services/events.service.js";
import { usePhoneRequirement } from "../hooks/usePhoneRequirement.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { resolveDriveThumbnailProxyUrl, resolveDriveUrl } from "../constants/videoUrls.js";
import { getEventVideoSource } from "../utils/eventVideoSource.js";
import { compressImageToBase64 } from "../utils/imageCompression.js";
import "./Events.css";

function formatDate(value, language, timezone) {
  return new Intl.DateTimeFormat(language, { dateStyle: "full", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

function formatTime(value, language, timezone) {
  return new Intl.DateTimeFormat(language, { timeStyle: "short", timeZone: timezone || "Africa/Tunis" }).format(new Date(value));
}

function getMapsUrl(location) {
  if (/^https?:\/\//i.test(location || "")) return location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || "")}`;
}

function getMapSearchLocation(location, description) {
  const normalizedLocation = (location || "").replace(/\/+$/, "");
  const knownMapLinks = {
    "https://maps.app.goo.gl/R4JBunHzfqFemjNX9": "24 Rue Mendes France, Ariana 2036, Tunisia",
    "https://maps.app.goo.gl/fapcW6wn8dZgZaFX9": "Lac 1, Tunis, Tunisia",
    "https://maps.app.goo.gl/YJY6vKBw1RJJ9XEo7": "Sahloul, Sousse, Tunisia",
  };
  if (knownMapLinks[normalizedLocation]) return knownMapLinks[normalizedLocation];

  if (/^https?:\/\//i.test(location || "")) {
    try {
      const url = new URL(location);
      const query = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("destination");
      if (query) return query;
      const place = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1];
      if (place) return decodeURIComponent(place.replace(/\+/g, " "));
    } catch {
      return "Tunisia";
    }

    const descriptionLocation = description?.match(/(?:location|lieu)\s*:\s*([^.\n\r]+)/i)?.[1]
      ?.replace(/https?:\/\/\S+/gi, "")
      .split(/\b(?:and online|et en ligne)\b/i)[0]
      .trim();
    return descriptionLocation || "Tunisia";
  }

  return location || "Tunisia";
}

function splitName(name) {
  const parts = (name || "").trim().split(/\s+/);
  return [parts[0] || "", parts.slice(1).join(" ")];
}

function createFeedbackForm(name) {
  const [firstName, lastName] = splitName(name);
  return { firstName, lastName, rating: 5, comment: "", image: "" };
}

export default function EventDetailPageRoute() {
  const { id } = useParams();
  return <EventDetailPage key={id} />;
}

function EventDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { runWithPhone, phoneRequiredModal } = usePhoneRequirement();
  const location = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [participationModal, setParticipationModal] = useState("");
  const [feedbackLoginDismissed, setFeedbackLoginDismissed] = useState(false);
  const [registrationDetails, setRegistrationDetails] = useState(null);
  const [sessionUrl, setSessionUrl] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackFileError, setFeedbackFileError] = useState("");
  const [feedbackImageLoading, setFeedbackImageLoading] = useState(false);
  const [feedbackStatusResult, setFeedbackStatusResult] = useState(null);
  const [publishedFeedbacks, setPublishedFeedbacks] = useState([]);
  const [publishedFeedbacksLoading, setPublishedFeedbacksLoading] = useState(true);
  const [publishedFeedbacksError, setPublishedFeedbacksError] = useState("");
  const [feedbackFormState, setFeedbackFormState] = useState(null);
  const feedbackForm = feedbackFormState || createFeedbackForm(user?.name);
  const setFeedbackForm = (update) => {
    setFeedbackFormState((current) => {
      const currentForm = current || createFeedbackForm(user?.name);
      return typeof update === "function" ? update(currentForm) : update;
    });
  };
  const registrationLock = useRef(false);
  const feedbackLock = useRef(false);
  const feedbackPromptedForEvent = useRef("");
  const participationConfirmed = user?.role === "étudiant" &&
    event?.registrationRequired &&
    registrationDetails?.eventId === id &&
    registrationDetails?.studentId === user?._id;
  const meetingUrl = participationConfirmed ? registrationDetails.meetingUrl : "";
  const eventEnded = Boolean(event && new Date(event.endsAt || event.startsAt) <= new Date());
  const capacityReached = Boolean(event && event.capacity !== null && event.capacity !== undefined &&
    event.registrationCount >= event.capacity);
  const eventStatus = event?.status;
  const shouldCheckFeedback = user?.role === "étudiant" && participationConfirmed && eventEnded;
  const feedbackStatusLoading = shouldCheckFeedback && feedbackStatusResult?.eventId !== id;
  const feedbackStatusError = feedbackStatusResult?.eventId === id ? feedbackStatusResult.error : "";
  const hasSubmittedFeedback = feedbackStatusResult?.eventId === id && feedbackStatusResult.submitted;
  const feedbackRequested = new URLSearchParams(location.search).get("feedback") === "1";
  const activeParticipationModal = participationModal || (
    feedbackRequested && !feedbackLoginDismissed && !authLoading && !user ? "feedbackLogin" : ""
  );

  useDocumentMeta({ title: event ? `${event.title} — TheBridgeFlow` : t("events.title"), description: event?.description || t("events.description") });

  useEffect(() => {
    let active = true;
    eventsService.getOne(id)
      .then(({ data }) => {
        if (!active) return;
        setEvent(data.event);
        if (data.event.status !== "published") {
          setPublishedFeedbacks([]);
          setPublishedFeedbacksLoading(false);
        }
      })
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

  useEffect(() => {
    if (eventStatus !== "published") return undefined;
    let active = true;
    eventsService.getPublishedFeedbacks(id)
      .then(({ data }) => {
        if (!active) return;
        setPublishedFeedbacks(data.feedbacks || []);
        setPublishedFeedbacksError("");
      })
      .catch((requestError) => {
        if (!active) return;
        console.error("Failed to load published event feedback", requestError);
        setPublishedFeedbacksError(t("events.feedback.loadError"));
      })
      .finally(() => {
        if (active) setPublishedFeedbacksLoading(false);
      });
    return () => { active = false; };
  }, [eventStatus, id, t]);

  useEffect(() => {
    if (!shouldCheckFeedback) return undefined;
    let active = true;
    eventsService.getMyFeedback(id)
      .then(({ data }) => {
        if (!active) return;
        const submitted = Boolean(data.feedback);
        setFeedbackStatusResult({ eventId: id, submitted, error: "" });
        if (!submitted && feedbackPromptedForEvent.current !== id) {
          feedbackPromptedForEvent.current = id;
          setFeedbackOpen(true);
        }
      })
      .catch((requestError) => {
        if (!active) return;
        console.error("Failed to check event feedback status", requestError);
        setFeedbackStatusResult({
          eventId: id,
          submitted: false,
          error: requestError.response?.data?.message || t("events.feedback.statusError"),
        });
      });
    return () => { active = false; };
  }, [id, shouldCheckFeedback, t]);

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
      if (err.response?.data?.message?.includes("déjà inscrit")) {
        setRegistrationDetails({ eventId: id, studentId: user._id, meetingUrl: "" });
        setParticipationModal("alreadyRegistered");
        return;
      }
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

  const openSessionRecording = async () => {
    if (!user) {
      setParticipationModal("sessionLogin");
      return;
    }
    if (sessionLoading || sessionUrl) return;
    setSessionError("");
    setSessionLoading(true);
    try {
      const { data } = await eventsService.getSessionLink(id);
      setSessionUrl(data.sessionUrl);
    } catch (requestError) {
      setSessionError(requestError.response?.data?.message || t("events.sessionLinkError"));
    } finally {
      setSessionLoading(false);
    }
  };

  const handleFeedbackFile = async (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    setFeedbackImageLoading(true);
    setFeedbackFileError("");
    try {
      const image = await compressImageToBase64(file, { maxWidth: 800, quality: 0.8 });
      setFeedbackForm((current) => ({ ...current, image }));
    } catch (uploadError) {
      setFeedbackFileError(uploadError.message || t("events.feedback.imageError"));
    } finally {
      setFeedbackImageLoading(false);
      changeEvent.target.value = "";
    }
  };

  const handleFeedbackSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (feedbackLock.current) return;
    feedbackLock.current = true;
    setFeedbackSubmitting(true);
    setFeedbackError("");
    try {
      await eventsService.submitFeedback(id, feedbackForm);
      setFeedbackStatusResult({ eventId: id, submitted: true, error: "" });
      setFeedbackSent(true);
    } catch (submitError) {
      setFeedbackError(submitError.response?.data?.message || t("events.feedback.submitError"));
    } finally {
      feedbackLock.current = false;
      setFeedbackSubmitting(false);
    }
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
                <div className="ev-detail__content">
                  <div className="ev-detail__header-row">
                    <Link to="/events" className="ev-back">{t("events.back")}</Link>
                    <span className="ev-category">{event.category}</span>
                  </div>
                  <div className={`ev-detail__hero-banner${event.image ? " has-image" : ""}`}>
                    <div className="ev-detail__hero-copy">
                      <span className="ev-detail__eyebrow">{t("events.registrationEyebrow")}</span>
                      <h1>{event.title}</h1>
                      {participationConfirmed && !eventEnded && (
                        <div className="ev-detail__reminder">
                          <BellRing size={18} aria-hidden="true" />
                          <span>{t("events.remindersScheduled")}</span>
                        </div>
                      )}
                    </div>
                    {event.image
                      ? <div className="ev-detail__media">
                          <img className="ev-detail__image" src={resolveDriveThumbnailProxyUrl(event.image) || resolveDriveUrl(event.image, "image")} alt={event.title} />
                        </div>
                      : null}
                  </div>
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
                        <span><span className="ev-detail__fact-label">{t("events.locationLabel")}</span><a href={getMapsUrl(event.location)} target="_blank" rel="noopener noreferrer">{event.location}</a></span>
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
                  {event.sessionLinkAvailable && eventEnded && (
                    <div className="ev-detail__session-link">
                      <button
                        className="btn btn-primary ev-session-recording-btn"
                        type="button"
                        onClick={openSessionRecording}
                        disabled={sessionLoading}
                      >
                        {sessionLoading ? t("events.sessionLoading") : t("events.openSessionLink")}
                      </button>
                      {sessionError && <p className="ev-error" role="alert">{sessionError}</p>}
                      {sessionUrl && (() => {
                        const source = getEventVideoSource(sessionUrl);
                        return (
                          <div className="ev-detail__recording" aria-label={t("events.sessionLinkTitle")}>
                            <div className="ev-recording__player">
                              {source.type === "video"
                                ? <video src={source.src} controls playsInline preload="metadata" />
                                : <iframe src={source.src} title={event.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <section className="ev-detail__description-section">
                    <h2>{t("events.descriptionLabel")}</h2>
                    <p className="ev-detail__description">{event.description}</p>
                  </section>
                  {event.location && (
                    <div className="ev-detail__map-card">
                      <div className="ev-detail__map-header">
                        <MapPin size={18} aria-hidden="true" />
                        <span>{t("events.mapTitle")}</span>
                      </div>
                      <a href={getMapsUrl(event.location)} target="_blank" rel="noopener noreferrer" className="ev-detail__map-link">
                        <span>{event.location}</span>
                        <ExternalLink size={15} aria-hidden="true" />
                      </a>
                      <iframe
                        className="ev-detail__map"
                        title={t("events.mapTitle")}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(getMapSearchLocation(event.location, event.description))}&z=15&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  )}
                  {event.status === "published" && (
                    <section className="ev-detail__feedback-list" aria-labelledby="ev-feedback-list-title">
                      <div className="ev-detail__feedback-heading">
                        <div>
                          <span className="ev-detail__eyebrow">{t("events.feedback.eyebrow")}</span>
                          <h2 id="ev-feedback-list-title">{t("events.feedback.publicTitle")}</h2>
                        </div>
                        {!publishedFeedbacksLoading && publishedFeedbacks.length > 0 && (
                          <span className="ev-detail__feedback-count">
                            {t("events.feedback.publishedCount", { count: publishedFeedbacks.length })}
                          </span>
                        )}
                      </div>
                      {publishedFeedbacksLoading ? (
                        <div className="ev-detail__feedback-empty" role="status">{t("common.loading")}</div>
                      ) : publishedFeedbacksError ? (
                        <p className="ev-error" role="alert">{publishedFeedbacksError}</p>
                      ) : publishedFeedbacks.length === 0 ? (
                        <div className="ev-detail__feedback-empty">
                          <MessageSquareText size={20} aria-hidden="true" />
                          <span>{t("events.feedback.noPublished")}</span>
                        </div>
                      ) : (
                        <div className="ev-detail__feedback-grid">
                          {publishedFeedbacks.map((feedback) => (
                            <article className="ev-detail__feedback-card" key={feedback._id}>
                              <div className="ev-detail__feedback-stars" aria-label={t("events.feedback.ratingLabel", { rating: feedback.rating })}>
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <Star
                                    key={value}
                                    size={16}
                                    aria-hidden="true"
                                    fill={feedback.rating >= value ? "currentColor" : "none"}
                                  />
                                ))}
                              </div>
                              <p>{feedback.comment}</p>
                              <div className="ev-detail__feedback-author">
                                {feedback.image
                                  ? <img src={feedback.image} alt="" />
                                  : <span aria-hidden="true">{feedback.firstName?.charAt(0) || ""}</span>}
                                <span>
                                  <strong>{feedback.firstName} {feedback.lastName}</strong>
                                  <small>{t("events.feedback.verifiedParticipant")}</small>
                                </span>
                                <CheckCircle2 size={17} aria-label={t("events.feedback.verifiedParticipant")} />
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  {error && <p className="ev-form-error" role="alert">{error}</p>}
                  {event.status === "cancelled" && <p className="ev-form-error" role="status">{t("events.cancelledMessage")}</p>}
                  {feedbackStatusError && <p className="ev-form-error" role="alert">{feedbackStatusError}</p>}
                  {event.status === "published" && event.registrationRequired === true && !eventEnded &&
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
                  {eventEnded && user?.role === "étudiant" && participationConfirmed && !hasSubmittedFeedback && (
                    <button
                      type="button"
                      className="ev-feedback-trigger"
                      onClick={() => { setFeedbackError(""); setFeedbackOpen(true); }}
                      disabled={feedbackStatusLoading}
                    >
                      <MessageSquareText size={18} aria-hidden="true" />
                      {feedbackStatusLoading ? t("events.feedback.checking") : t("events.feedback.openForm")}
                    </button>
                  )}
                  {eventEnded && hasSubmittedFeedback && (
                    <p className="ev-feedback-submitted" role="status">
                      <CheckCircle2 size={18} aria-hidden="true" /> {t("events.feedback.submittedNotice")}
                    </p>
                  )}
                </div>
              </article>
            )}
      </main>
      {(activeParticipationModal === "login" || activeParticipationModal === "sessionLogin" || activeParticipationModal === "feedbackLogin") && (
        <Modal
          title={t("events.loginRequiredTitle")}
          maxWidth={activeParticipationModal === "feedbackLogin" ? 400 : 520}
          onClose={() => {
            setParticipationModal("");
            if (activeParticipationModal === "feedbackLogin") setFeedbackLoginDismissed(true);
          }}
          footer={<>
            <button type="button" className="btn btn-ghost" onClick={() => {
              setParticipationModal("");
              if (activeParticipationModal === "feedbackLogin") setFeedbackLoginDismissed(true);
            }}>{t("common.cancel")}</button>
            <button type="button" className="btn btn-primary" onClick={() => navigate("/login", { state: { from: `${location.pathname}${location.search}` } })}>{t("events.signIn")}</button>
          </>}
        >
          <p>{t(
            activeParticipationModal === "sessionLogin"
              ? "events.sessionLoginMessage"
              : activeParticipationModal === "feedbackLogin"
                ? "events.feedback.loginRequiredMessage"
                : "events.loginRequiredMessage"
          )}</p>
        </Modal>
      )}
      {participationModal === "success" && (
        <Modal
          title={t("events.participationSuccessTitle")}
          onClose={() => setParticipationModal("")}
          footer={<button type="button" className="btn btn-primary" onClick={() => setParticipationModal("")}>{t("events.close")}</button>}
        >
          <p>{t("events.participationSuccessMessage", { email: user?.email || "" })}</p>
        </Modal>
      )}
      {participationModal === "alreadyRegistered" && (
        <Modal
          title={t("events.alreadyRegisteredTitle")}
          onClose={() => setParticipationModal("")}
          footer={<button type="button" className="btn btn-primary" onClick={() => setParticipationModal("")}>{t("events.close")}</button>}
        >
          <p>{t("events.alreadyRegisteredMessage")}</p>
        </Modal>
      )}
      {feedbackOpen && (
        <Modal
          title={feedbackSent ? t("events.feedback.thanksTitle") : t("events.feedback.title")}
          onClose={() => {
            if (!feedbackSubmitting) {
              setFeedbackOpen(false);
              setFeedbackSent(false);
            }
          }}
          maxWidth={640}
          className="ev-feedback-modal"
        >
          {feedbackSent ? (
            <div className="ev-feedback-success" role="status">
              <div className="ev-feedback-success__stars" aria-hidden="true">
                <Star className="ev-feedback-success__star ev-feedback-success__star--one" size={22} fill="currentColor" />
                <Star className="ev-feedback-success__star ev-feedback-success__star--two" size={30} fill="currentColor" />
                <Star className="ev-feedback-success__star ev-feedback-success__star--three" size={19} fill="currentColor" />
                <span><CheckCircle2 size={34} /></span>
              </div>
              <h3>{t("events.feedback.thanksTitle")}</h3>
              <p>{t("events.feedback.thanksMessage")}</p>
              <button type="button" className="btn btn-primary" onClick={() => { setFeedbackOpen(false); setFeedbackSent(false); }}>
                {t("events.close")}
              </button>
            </div>
          ) : (
            <form className="ev-feedback-form" onSubmit={handleFeedbackSubmit}>
              <div className="ev-feedback-form__grid">
                <label>
                  {t("events.feedback.firstName")}
                  <input
                    value={feedbackForm.firstName}
                    onChange={(event) => setFeedbackForm((current) => ({ ...current, firstName: event.target.value }))}
                    maxLength={80}
                    autoComplete="given-name"
                    required
                  />
                </label>
                <label>
                  {t("events.feedback.lastName")}
                  <input
                    value={feedbackForm.lastName}
                    onChange={(event) => setFeedbackForm((current) => ({ ...current, lastName: event.target.value }))}
                    maxLength={80}
                    autoComplete="family-name"
                    required
                  />
                </label>
              </div>
              <div className="ev-feedback-rating">
                <span>{t("events.feedback.rating")}</span>
                <div className="ev-feedback-stars" role="group" aria-label={t("events.feedback.rating")}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`ev-feedback-star${feedbackForm.rating >= value ? " is-active" : ""}`}
                      onClick={() => setFeedbackForm((current) => ({ ...current, rating: value }))}
                      aria-label={t("events.feedback.rateOutOfFive", { rating: value })}
                      aria-pressed={feedbackForm.rating === value}
                    >
                      <Star size={20} aria-hidden="true" fill={feedbackForm.rating >= value ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <span className="ev-feedback-rating__value">{feedbackForm.rating}/5</span>
              </div>
              <label>
                {t("events.feedback.comment")}
                <textarea
                  rows={5}
                  value={feedbackForm.comment}
                  onChange={(event) => setFeedbackForm((current) => ({ ...current, comment: event.target.value }))}
                  placeholder={t("events.feedback.commentPlaceholder")}
                  maxLength={2000}
                  required
                />
              </label>
              <label className="ev-feedback-upload">
                <span><Camera size={16} aria-hidden="true" /> {t("events.feedback.photo")} <small>{t("events.feedback.optional")}</small></span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFeedbackFile}
                  disabled={feedbackImageLoading}
                />
              </label>
              {feedbackForm.image && <img className="ev-feedback-preview" src={feedbackForm.image} alt={t("events.feedback.photoPreview")} />}
              {feedbackImageLoading && <p className="ev-feedback-hint" role="status">{t("events.feedback.imageLoading")}</p>}
              {feedbackFileError && <p className="ev-form-error" role="alert">{feedbackFileError}</p>}
              {feedbackError && <p className="ev-form-error" role="alert">{feedbackError}</p>}
              <p className="ev-feedback-hint">{t("events.feedback.reviewVisibilityNotice")}</p>
              <div className="ev-feedback-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setFeedbackOpen(false)} disabled={feedbackSubmitting}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn btn-primary" disabled={feedbackSubmitting || feedbackImageLoading}>
                  {feedbackSubmitting ? t("events.working") : t("events.feedback.submit")}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
