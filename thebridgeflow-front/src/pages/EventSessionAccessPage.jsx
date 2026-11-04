import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, Clock3, MapPin, Video } from "lucide-react";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import { eventsService } from "../services/events.service.js";
import { getEventVideoSource } from "../utils/eventVideoSource.js";
import "./Events.css";

export default function EventSessionAccessPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [sessionUrl, setSessionUrl] = useState("");
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    eventsService.getSessionLink(id)
      .then(({ data }) => {
        if (active) {
          setSessionUrl(data.sessionUrl);
          setEvent(data.event);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || t("events.sessionLinkError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, t]);

  const video = sessionUrl ? getEventVideoSource(sessionUrl) : null;

  return (
    <div className="ev-public-page">
      <SiteNavbar />
      <main className="ev-detail-wrap">
        <section className="ev-state" aria-live="polite">
          {loading ? <Loader size="lg" />
            : error ? <p className="ev-error" role="alert">{error}</p>
              : (
                <article className="ev-recording">
                  <Link className="ev-back" to={`/events/${encodeURIComponent(id)}`}>{t("events.back")}</Link>
                  <span className="ev-category">{event?.category || t("events.sessionLinkTitle")}</span>
                  <h1>{event?.title || t("events.sessionLinkTitle")}</h1>
                  <div className="ev-recording__player">
                    {video.type === "video"
                      ? <video src={video.src} controls playsInline preload="metadata" />
                      : <iframe src={video.src} title={event?.title || t("events.sessionLinkTitle")} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
                  </div>
                  <a className="ev-recording__external" href={sessionUrl} target="_blank" rel="noopener noreferrer">{t("events.openSessionLink")}</a>
                  <section className="ev-recording__details">
                    <h2>{t("events.descriptionLabel")}</h2>
                    <p>{event?.description || "—"}</p>
                    <div className="ev-recording__facts">
                      {event?.startsAt && <span><CalendarDays size={17} />{new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: event.timezone || "Africa/Tunis" }).format(new Date(event.startsAt))}</span>}
                      {event?.startsAt && <span><Clock3 size={17} />{new Intl.DateTimeFormat(i18n.language, { timeStyle: "short", timeZone: event.timezone || "Africa/Tunis" }).format(new Date(event.startsAt))}</span>}
                      {event?.location && <span><MapPin size={17} />{event.location}</span>}
                      {event?.mode && <span><Video size={17} />{t(`events.modes.${event.mode}`)}</span>}
                    </div>
                  </section>
                </article>
              )}
          {error && <p><Link to={`/events/${encodeURIComponent(id)}`}>{t("events.back")}</Link></p>}
        </section>
      </main>
    </div>
  );
}
