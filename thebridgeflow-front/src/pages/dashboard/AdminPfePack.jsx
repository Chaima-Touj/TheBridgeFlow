import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2, CalendarClock, CircleAlert, CircleCheck, Download, Inbox, Laptop, LoaderCircle, Mail, MapPin, MapPinned,
  Phone, RefreshCw, School, Search, SearchX, UserRound, X,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import BreakableEmail from "../../components/common/BreakableEmail.jsx";
import { RequestStatusBadge, RequestStatusFilter, RequestStatusPicker } from "../../components/common/RequestStatus.jsx";
import { pfePackService } from "../../services/pfePack.service.js";
import { buildPfePackEmailsPdf } from "../../utils/exportPfePackEmails.js";
import {
  applyStatusUpdate, countByStatus, filterRegistrations, groupTechnologies, initials, mailtoHref, registrationStatus,
  telHref,
} from "../../utils/pfePackAdmin.js";
import "./AdminPfePack.css";

const LOCALES = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" };
// Même seuil que le CSS : au-delà, liste et détail côte à côte.
const WIDE_LAYOUT = "(min-width: 1101px)";
const matches = (query) => typeof window !== "undefined" && Boolean(window.matchMedia?.(query)?.matches);
const FEEDBACK_DELAY_MS = 3500;

export default function AdminPfePack() {
  const { t, i18n } = useTranslation();
  const ta = (key, options) => t(`adminPfePack.${key}`, options);
  const locale = LOCALES[(i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2)] || "fr-FR";
  const formatDate = (value, withTime = false) => (value
    ? new Date(value).toLocaleString(locale, withTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" })
    : "");

  const [registrations, setRegistrations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState("");
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  // Changement de statut en cours : { id, status }.
  const [statusBusy, setStatusBusy] = useState(null);
  // Retour après un changement de statut : { id, type, message }.
  const [feedback, setFeedback] = useState(null);
  const listRef = useRef(null);
  const detailRef = useRef(null);
  const sectionId = useId();

  useEffect(() => {
    let active = true;
    pfePackService.getRegistrations()
      .then(({ data }) => {
        if (!active) return;
        const entries = Array.isArray(data) ? data : [];
        // Grand écran : la première demande est affichée par défaut.
        const fallbackId = (matches(WIDE_LAYOUT) && entries[0]?._id) || "";
        setRegistrations(entries);
        setLoaded(true);
        setActiveId((current) => (entries.some((entry) => entry._id === current) ? current : fallbackId));
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || t("adminPfePack.loadError"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, t]);

  // Détail complet (sujet, auteur du dernier changement de statut). Une réponse
  // arrivée après un changement de sélection est ignorée.
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
  }, [activeId, reloadKey, detailReloadKey, t]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const counts = useMemo(() => countByStatus(registrations), [registrations]);
  const filtered = useMemo(() => filterRegistrations(registrations, { status, search }), [registrations, status, search]);
  const hasFilters = status !== "all" || search.trim() !== "";

  /* La ligne de la liste contient déjà l'essentiel : le détail s'affiche tout
     de suite, le sujet arrive avec GET /:id. Le statut de la liste (mis à jour
     après un changement) l'emporte sur une réponse de détail plus ancienne. */
  const summary = registrations.find((registration) => registration._id === activeId) || null;
  const detail = details?._id === activeId ? details : null;
  const selected = summary || detail ? { ...detail, ...summary } : null;
  const detailLoading = Boolean(selected && !detail && detailError?.id !== activeId);
  const detailFailed = Boolean(selected && !detail && detailError?.id === activeId);

  const refreshRegistrations = () => {
    setLoading(true);
    setReloadKey((current) => current + 1);
  };
  const retryDetail = () => {
    setDetailError(null);
    setDetailReloadKey((current) => current + 1);
  };
  const resetFilters = () => {
    setStatus("all");
    setSearch("");
  };
  const exportEmails = () => {
    const { doc, filename } = buildPfePackEmailsPdf(registrations);
    doc.save(filename);
  };

  const selectRegistration = (registration) => {
    setActiveId(registration._id);
    // Petit écran : le détail s'affiche sous la liste, on l'amène à l'écran.
    requestAnimationFrame(() => {
      if (matches(WIDE_LAYOUT) || !detailRef.current) return;
      detailRef.current.scrollIntoView({ behavior: matches("(prefers-reduced-motion: reduce)") ? "auto" : "smooth", block: "start" });
      detailRef.current.focus({ preventScroll: true });
    });
  };

  // Fermer le détail ramène le focus sur la ligne correspondante.
  const closeDetail = () => {
    const id = activeId;
    setActiveId("");
    requestAnimationFrame(() => {
      const selector = `[data-registration-id="${window.CSS?.escape ? window.CSS.escape(id) : id}"]`;
      const row = listRef.current?.querySelector(selector);
      (row || listRef.current)?.focus();
    });
  };

  const changeStatus = async (registration, nextStatus) => {
    if (statusBusy) return;
    setStatusBusy({ id: registration._id, status: nextStatus });
    try {
      const { data } = await pfePackService.updateStatus(registration._id, nextStatus);
      const updated = data?.registration;
      if (!updated?._id) throw new Error("Invalid response");
      // Liste et compteurs mis à jour localement, sans recharger la page.
      setRegistrations((list) => applyStatusUpdate(list, updated));
      setDetails((current) => (current?._id === updated._id ? { ...current, ...updated } : current));
      // Détail pas encore reçu : une réponse partie avant le changement serait
      // périmée (auteur du statut) ; elle est ignorée et le détail rechargé.
      if (details?._id !== updated._id) setDetailReloadKey((current) => current + 1);
      setFeedback({
        id: updated._id,
        type: "success",
        message: t("requestStatus.updated", { status: t(`requestStatus.${registrationStatus(updated)}`) }),
      });
    } catch {
      setFeedback({ id: registration._id, type: "error", message: t("requestStatus.updateError") });
    } finally {
      setStatusBusy(null);
    }
  };

  const renderList = () => {
    if (!loaded && loading) {
      return (
        <div className="appfe-state" role="status">
          <LoaderCircle className="appfe-spin" size={22} aria-hidden="true" />
          <span>{ta("loading")}</span>
        </div>
      );
    }
    if (!loaded && error) {
      return (
        <div className="appfe-state appfe-state--error" role="alert">
          <span className="appfe-state__icon"><CircleAlert size={22} aria-hidden="true" /></span>
          <span>{error}</span>
          <button type="button" className="btn btn-primary" onClick={refreshRegistrations}>{ta("retry")}</button>
        </div>
      );
    }
    if (!registrations.length) {
      return (
        <div className="appfe-state">
          <span className="appfe-state__icon"><Inbox size={24} aria-hidden="true" /></span>
          <strong>{ta("emptyTitle")}</strong>
          <span>{ta("emptyText")}</span>
        </div>
      );
    }
    if (!filtered.length) {
      return (
        <div className="appfe-state">
          <span className="appfe-state__icon"><SearchX size={24} aria-hidden="true" /></span>
          <strong>{ta("noResultsTitle")}</strong>
          <span>{ta("noResultsText")}</span>
          <button type="button" className="btn btn-ghost appfe-btn" onClick={resetFilters}>{ta("resetFilters")}</button>
        </div>
      );
    }
    return (
      <ul className="appfe-list">
        {filtered.map((registration) => {
          const isActive = registration._id === activeId;
          const place = [registration.university, registration.city].filter(Boolean).join(" · ");
          return (
            <li key={registration._id}>
              <button
                type="button"
                className={`appfe-row${isActive ? " appfe-row--active" : ""}`}
                data-registration-id={registration._id}
                aria-pressed={isActive}
                onClick={() => selectRegistration(registration)}
              >
                <span className="appfe-avatar" aria-hidden="true">
                  {initials(registration.firstName, registration.lastName) || <UserRound size={16} />}
                </span>
                <span className="appfe-row__main">
                  <strong>{registration.firstName} {registration.lastName}</strong>
                  <small className="appfe-row__email" dir="ltr">{registration.email}</small>
                  {place && <small className="appfe-row__place">{place}</small>}
                </span>
                <span className="appfe-row__side">
                  <time dateTime={registration.createdAt}>{formatDate(registration.createdAt)}</time>
                  <RequestStatusBadge status={registration.status} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  // Valeur absente : « Non renseigné ».
  const fact = (Icon, label, value, props = {}) => (
    <div>
      <dt><Icon size={14} aria-hidden="true" />{label}</dt>
      {value ? <dd {...props}>{value}</dd> : <dd className="appfe-facts__empty">{ta("notProvided")}</dd>}
    </div>
  );

  const renderDetail = () => {
    if (!selected) {
      return (
        <div className="appfe-state appfe-state--compact">
          <span className="appfe-state__icon"><UserRound size={22} aria-hidden="true" /></span>
          <span>{ta("selectHint")}</span>
        </div>
      );
    }
    const onsite = selected.locationMode === "onsite";
    const busy = statusBusy?.id === selected._id ? statusBusy.status : "";
    const shownFeedback = feedback?.id === selected._id ? feedback : null;
    const updatedMeta = selected.statusUpdatedAt && (detail || selected.statusUpdatedBy)
      ? t("requestStatus.updatedBy", { name: selected.statusUpdatedBy?.name || "—", date: formatDate(selected.statusUpdatedAt, true) })
      : null;
    const technologyGroups = groupTechnologies(selected.technologies);
    const section = (key, title, children) => (
      <section className="appfe-section" aria-labelledby={`${sectionId}-${key}`}>
        <h3 className="appfe-section__title" id={`${sectionId}-${key}`}>{title}</h3>
        {children}
      </section>
    );

    return (
      <>
        <header className="appfe-detail__head">
          <span className="appfe-avatar appfe-avatar--lg" aria-hidden="true">
            {initials(selected.firstName, selected.lastName) || <UserRound size={20} />}
          </span>
          <div className="appfe-detail__title">
            <h2>{selected.firstName} {selected.lastName}</h2>
            <div className="appfe-detail__meta">
              <RequestStatusBadge status={selected.status} />
              <span className="appfe-detail__received">
                <CalendarClock size={14} aria-hidden="true" />
                {ta("receivedAt", { date: formatDate(selected.createdAt, true) })}
              </span>
            </div>
          </div>
          <button type="button" className="appfe-detail__close" onClick={closeDetail} aria-label={ta("closeDetail")}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="appfe-detail__actions">
          {selected.email && (
            <a className="btn btn-ghost appfe-btn" href={mailtoHref(selected.email)}><Mail size={16} aria-hidden="true" />{ta("sendEmail")}</a>
          )}
          {selected.phone && (
            <a className="btn btn-ghost appfe-btn" href={telHref(selected.phone)}><Phone size={16} aria-hidden="true" />{ta("call")}</a>
          )}
        </div>

        {section("contact", ta("sectionContact"), (
          <dl className="appfe-facts">
            {fact(Mail, ta("email"), selected.email && <BreakableEmail email={selected.email} />, { dir: "ltr" })}
            {fact(Phone, ta("phone"), selected.phone, { dir: "ltr" })}
          </dl>
        ))}

        {section("profile", ta("sectionProfile"), (
          <dl className="appfe-facts">
            {fact(School, ta("university"), selected.university)}
            {fact(MapPin, ta("city"), selected.city)}
          </dl>
        ))}

        {section("internship", ta("sectionInternship"), (
          <dl className="appfe-facts">
            {fact(onsite ? Building2 : Laptop, ta("locationMode"), selected.locationMode ? ta(onsite ? "onsite" : "remote") : "")}
            {onsite && fact(MapPinned, ta("preferredLocation"), selected.preferredLocation)}
          </dl>
        ))}

        {section("technologies", ta("technologiesCount", { count: selected.technologies?.length || 0 }), (
          technologyGroups.length ? (
            <ul className="appfe-techs">
              {technologyGroups.map((group) => (
                <li className="appfe-tech" key={group.name}>
                  <span className="appfe-tech__name">{group.name}</span>
                  {group.details.length > 0 && (
                    <span className="appfe-tech__details">
                      {group.details.map((item) => <span className="appfe-tech__detail" key={item}>{item}</span>)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="appfe-facts__empty">{ta("notProvided")}</p>
        ))}

        {detail?.subject && section("subject", ta("subject"), <p className="appfe-subject">{detail.subject}</p>)}
        {detailLoading && (
          <p className="appfe-detail__loading" role="status">
            <LoaderCircle className="appfe-spin" size={15} aria-hidden="true" />{ta("loadingDetails")}
          </p>
        )}
        {detailFailed && (
          <div className="appfe-feedback appfe-feedback--error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>{detailError.message}</span>
            <button type="button" className="appfe-feedback__action" onClick={retryDetail}>{ta("retry")}</button>
          </div>
        )}

        <div className="appfe-status">
          <RequestStatusPicker
            value={selected.status}
            busyStatus={busy}
            onChange={(nextStatus) => changeStatus(selected, nextStatus)}
            meta={updatedMeta}
          />
          <div className="appfe-status__live" aria-live="polite">
            {shownFeedback && (
              <p className={`appfe-feedback appfe-feedback--${shownFeedback.type}`} role={shownFeedback.type === "error" ? "alert" : undefined}>
                {shownFeedback.type === "error" ? <CircleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
                <span>{shownFeedback.message}</span>
              </p>
            )}
          </div>
        </div>
      </>
    );
  };

  const showDetailPanel = loaded && registrations.length > 0;

  return (
    <DashboardLayout title={ta("title")} subtitle={ta("subtitle")}>
      <div className="appfe-page">
        <section className="appfe-toolbar" aria-label={ta("toolbarLabel")}>
          <div className="appfe-toolbar__row">
            <RequestStatusFilter value={status} counts={counts} onChange={setStatus} />
            <div className="appfe-toolbar__actions">
              <button type="button" className="btn btn-ghost appfe-btn" onClick={refreshRegistrations} disabled={loading}>
                <RefreshCw size={16} className={loading && loaded ? "appfe-spin" : ""} aria-hidden="true" />
                {ta("refresh")}
              </button>
              <button type="button" className="btn btn-primary appfe-btn" onClick={exportEmails} disabled={registrations.length === 0}>
                <Download size={16} aria-hidden="true" />
                {ta("export")}
              </button>
            </div>
          </div>
          <label className="appfe-search">
            <span className="appfe-sr-only">{ta("searchLabel")}</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={ta("searchPlaceholder")}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label={t("common.clearSearch")}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </label>
        </section>

        {loaded && error && (
          <div className="appfe-feedback appfe-feedback--error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>{error}</span>
            <button type="button" className="appfe-feedback__action" onClick={refreshRegistrations} disabled={loading}>{ta("retry")}</button>
          </div>
        )}

        <div className={`appfe-layout${showDetailPanel ? "" : " appfe-layout--single"}`}>
          <section className="appfe-panel appfe-list-panel" aria-busy={loading} ref={listRef} tabIndex={-1} aria-label={ta("listLabel")}>
            {showDetailPanel && (
              <div className="appfe-list__head" aria-live="polite">
                {hasFilters
                  ? ta("filteredCount", { shown: filtered.length, total: registrations.length })
                  : ta("count", { count: registrations.length })}
              </div>
            )}
            {renderList()}
          </section>

          {showDetailPanel && (
            <aside
              className={`appfe-panel appfe-detail${selected ? "" : " appfe-detail--empty"}`}
              ref={detailRef}
              tabIndex={-1}
              aria-label={ta("detailLabel")}
            >
              {renderDetail()}
            </aside>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
