import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import Loader from "../components/common/Loader.jsx";
import { eventsService } from "../services/events.service.js";
import "./Events.css";

export default function EventSessionAccessPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [sessionUrl, setSessionUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    eventsService.getSessionLink(id)
      .then(({ data }) => {
        if (active) setSessionUrl(data.sessionUrl);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || t("events.sessionLinkError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, t]);

  return (
    <div className="ev-public-page">
      <SiteNavbar />
      <main className="ev-detail-wrap">
        <section className="ev-state" aria-live="polite">
          {loading ? <Loader size="lg" />
            : error ? <p className="ev-error" role="alert">{error}</p>
              : (
                <>
                  <h1>{t("events.sessionLinkTitle")}</h1>
                  <a className="btn btn-primary" href={sessionUrl} target="_blank" rel="noopener noreferrer">
                    {t("events.openSessionLink")}
                  </a>
                </>
              )}
          <p><Link to={`/events/${encodeURIComponent(id)}`}>{t("events.back")}</Link></p>
        </section>
      </main>
    </div>
  );
}
