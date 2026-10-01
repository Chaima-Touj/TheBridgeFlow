import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, MapPin } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { eventsService } from "../../services/events.service.js";
import "../Events.css";

export default function MyEvents() {
  const { t, i18n } = useTranslation();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    eventsService.getMyRegistrations()
      .then(({ data }) => { setRegistrations(data.registrations || []); setError(""); })
      .catch((err) => setError(err.response?.data?.message || t("events.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (eventId) => {
    setError("");
    try {
      await eventsService.cancelRegistration(eventId);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("events.actionError"));
    }
  };

  const active = registrations.filter((item) => item.status === "registered" && item.event);
  return (
    <DashboardLayout title={t("events.myTitle")} subtitle={t("events.mySubtitle")}>
      <div className="ev-dashboard">
        {error && <p className="ev-form-error" role="alert">{error}</p>}
        {loading ? <div className="sd-skeleton" style={{ height: 180 }} />
          : active.length === 0 ? <div className="sd-empty-box"><p>{t("events.noRegistrations")}</p><Link className="btn btn-primary" to="/events">{t("events.browse")}</Link></div>
            : <div className="ev-list">
              {active.map(({ _id, event }) => (
                <article className="ev-row" key={_id}>
                  <div>
                    <span className="ev-category">{event.category}</span>
                    <h2><Link to={`/events/${event._id}`}>{event.title}</Link></h2>
                    <p><CalendarDays size={15} />{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone || "Africa/Tunis" }).format(new Date(event.startsAt))}</p>
                    <p>{t(`events.modes.${event.mode}`)}</p>
                    {event.location && <p><MapPin size={15} />{event.location}</p>}
                    {event.meetingUrl && <a className="btn btn-primary ev-meeting-link" href={event.meetingUrl} target="_blank" rel="noreferrer">{t("events.joinOnline")}</a>}
                  </div>
                  {new Date(event.startsAt) > new Date() && <button type="button" className="btn btn-ghost" onClick={() => cancel(event._id)}>{t("events.cancelRegistration")}</button>}
                </article>
              ))}
            </div>}
      </div>
    </DashboardLayout>
  );
}
