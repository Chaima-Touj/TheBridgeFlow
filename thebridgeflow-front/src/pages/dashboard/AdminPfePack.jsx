import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Mail, RefreshCw, Search, UserRound } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { pfePackService } from "../../services/pfePack.service.js";
import { buildPfePackEmailsPdf } from "../../utils/exportPfePackEmails.js";
import "./AdminPfePack.css";

export default function AdminPfePack() {
  const { t, i18n } = useTranslation();
  const [registrations, setRegistrations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [details, setDetails] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    pfePackService.getRegistrations()
      .then(({ data }) => {
        if (!active) return;
        const entries = Array.isArray(data) ? data : [];
        setRegistrations(entries);
        setActiveId((current) => entries.some((entry) => entry._id === current) ? current : entries[0]?._id || "");
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || t("adminPfePack.loadError"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, t]);

  useEffect(() => {
    if (!activeId) return undefined;
    let active = true;
    pfePackService.getRegistration(activeId)
      .then(({ data }) => {
        if (!active) return;
        setDetails(data);
        setDetailError(null);
      })
      .catch((requestError) => {
        if (active) setDetailError({
          id: activeId,
          message: requestError.response?.data?.message || t("adminPfePack.detailError"),
        });
      });
    return () => { active = false; };
  }, [activeId, reloadKey, t]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return registrations;
    return registrations.filter((registration) =>
      [registration.firstName, registration.lastName, registration.email]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  }, [registrations, search]);

  const dateLocale = i18n.language === "ar" ? "ar-TN" : i18n.language === "en" ? "en-GB" : "fr-FR";
  const exportEmails = () => {
    const { doc, filename } = buildPfePackEmailsPdf(registrations);
    doc.save(filename);
  };
  const refreshRegistrations = () => {
    setLoading(true);
    setReloadKey((current) => current + 1);
  };
  const isDetailLoading = Boolean(activeId && details?._id !== activeId && detailError?.id !== activeId);

  return (
    <DashboardLayout title={t("adminPfePack.title")} subtitle={t("adminPfePack.subtitle")}>
      <div className="appfe-page">
        <div className="appfe-toolbar">
          <div className="appfe-summary"><span><UserRound size={20} /></span><div><strong>{t("adminPfePack.count", { count: registrations.length })}</strong><small>{t("adminPfePack.countHint")}</small></div></div>
          <div className="appfe-actions">
            <button type="button" className="btn btn-ghost" onClick={refreshRegistrations} disabled={loading}><RefreshCw size={16} /> {t("adminPfePack.refresh")}</button>
            <button type="button" className="btn btn-primary" onClick={exportEmails} disabled={registrations.length === 0}><Download size={16} /> {t("adminPfePack.export")}</button>
          </div>
        </div>
        {error && <p className="appfe-error" role="alert">{error}</p>}
        {loading ? <p className="appfe-empty">{t("adminPfePack.loading")}</p>
          : registrations.length === 0 ? <p className="appfe-empty">{t("adminPfePack.empty")}</p>
            : <div className="appfe-layout">
              <aside className="appfe-list-panel">
                <label className="appfe-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("adminPfePack.search")} /></label>
                <div className="appfe-list">
                  {filtered.map((registration) => (
                    <button className={`appfe-item${activeId === registration._id ? " is-active" : ""}`} type="button" key={registration._id} onClick={() => setActiveId(registration._id)}>
                      <span className="appfe-avatar">{registration.firstName?.trim().charAt(0).toUpperCase() || "?"}</span>
                      <span className="appfe-item__content"><strong>{registration.firstName} {registration.lastName}</strong><span>{registration.email}</span><time>{new Date(registration.createdAt).toLocaleDateString(dateLocale)}</time></span>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="appfe-list__empty">{t("adminPfePack.noResults")}</p>}
                </div>
              </aside>
              <section className="appfe-details" aria-live="polite">
                {isDetailLoading ? <p className="appfe-empty">{t("adminPfePack.loadingDetails")}</p>
                  : detailError?.id === activeId ? <p className="appfe-error">{detailError.message}</p>
                    : details?._id === activeId && <>
                      <header className="appfe-details__header"><div><span>{t("adminPfePack.detailEyebrow")}</span><h2>{details.firstName} {details.lastName}</h2></div><UserRound size={22} /></header>
                      <div className="appfe-detail-grid">
                        <article><span>{t("adminPfePack.email")}</span><a href={`mailto:${details.email}`}><Mail size={15} /> {details.email}</a></article>
                        <article><span>{t("adminPfePack.phone")}</span><a href={`tel:${details.phone}`}>{details.phone}</a></article>
                        <article><span>{t("adminPfePack.registeredAt")}</span><p>{new Date(details.createdAt).toLocaleString(dateLocale)}</p></article>
                        <article className="appfe-detail-grid__wide"><span>{t("adminPfePack.technologies")}</span><div className="appfe-tags">{details.technologies?.map((technology) => <span key={technology}>{technology}</span>)}</div></article>
                        <article className="appfe-detail-grid__wide"><span>{t("adminPfePack.subject")}</span><p className="appfe-subject">{details.subject}</p></article>
                      </div>
                    </>}
              </section>
            </div>}
      </div>
    </DashboardLayout>
  );
}
