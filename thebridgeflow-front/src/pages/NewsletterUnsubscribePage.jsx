import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { newsletterService } from "../services/newsletter.service.js";
import "./Events.css";

export default function NewsletterUnsubscribePage() {
  const { token } = useParams();
  const { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: false, message: "", error: "" });

  const unsubscribe = async () => {
    if (state.loading || state.message) return;
    setState({ loading: true, message: "", error: "" });
    try {
      const { data } = await newsletterService.unsubscribe(token, i18n.language);
      setState({ loading: false, message: data.message || t("landing.unsubscribeSuccess"), error: "" });
    } catch (error) {
      setState({
        loading: false,
        message: "",
        error: error.response?.data?.message || t("landing.newsletterError"),
      });
    }
  };

  return (
    <div className="ev-public-page">
      <SiteNavbar />
      <main className="ev-detail-wrap">
        <section className="ev-state">
          <h1>{t("landing.unsubscribeTitle")}</h1>
          <p>{t("landing.unsubscribeDescription")}</p>
          {state.message && <p role="status">{state.message}</p>}
          {state.error && <p className="ev-error" role="alert">{state.error}</p>}
          {!state.message && (
            <button className="btn btn-primary" type="button" onClick={unsubscribe} disabled={state.loading}>
              {state.loading ? t("landing.newsletterSubmitting") : t("landing.unsubscribeAction")}
            </button>
          )}
          <p><Link to="/">{t("nav.home")}</Link></p>
        </section>
      </main>
    </div>
  );
}
