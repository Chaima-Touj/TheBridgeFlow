import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, X, RefreshCw, Mail, Phone, CalendarDays, CalendarClock, CalendarOff, GraduationCap, School, Inbox, SearchX,
  CircleAlert, CircleCheck, ChevronLeft, ChevronRight, LoaderCircle, UserRound, Sparkles, MessageSquareText,
  ListFilter, Reply,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import BreakableEmail from "../../components/common/BreakableEmail.jsx";
import { RequestStatusBadge, RequestStatusFilter, RequestStatusPicker } from "../../components/common/RequestStatus.jsx";
import { eventParticipationService } from "../../services/eventParticipation.service.js";
import { normalizeRequestStatus } from "../../utils/requestStatuses.js";
import { isContactMessage, replyMailtoHref, studyLevelLabel } from "../../utils/eventParticipation.js";
import "./AdminParticipationRequests.css";

/* Dashboard Admin → Messages du site : messages du formulaire de contact
   (nouveaux et anciens) et demandes de participation aux événements, avec
   leur suivi (Nouveau / Contacté / Confirmé). */

const LOCALES = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" };
const SEARCH_DEBOUNCE_MS = 350;

function initials(first = "", last = "") {
  return `${first.trim()[0] || ""}${last.trim()[0] || ""}`.toUpperCase();
}

// Icône de la colonne « type » d'une ligne.
function typeIconOf(item) {
  if (isContactMessage(item)) return MessageSquareText;
  if (item.eventTitle) return CalendarDays;
  return item.notifyUpcoming ? Sparkles : CalendarOff;
}

// Texte du serveur seulement pour une erreur 4xx (le texte d'une erreur 500 est technique).
const clientErrorMessage = (error) => {
  const status = error?.response?.status;
  return status >= 400 && status < 500 ? error.response.data?.message || "" : "";
};

export default function AdminParticipationRequests() {
  const { t, i18n } = useTranslation();
  const ta = (key, options) => t(`adminParticipation.${key}`, options);
  const locale = LOCALES[(i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2)] || "fr-FR";
  const formatDate = (value, withTime = true) => (value
    ? new Date(value).toLocaleString(locale, withTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" })
    : "—");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  // Type : all | contact | participation | <id d'événement> | upcoming | none.
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const filterKey = JSON.stringify([search, status, typeFilter, page]);
  const requestKey = JSON.stringify([filterKey, reloadKey]);
  const [result, setResult] = useState({ key: null, filterKey: null, data: null, error: "" });
  // Événements du filtre par type : la liste reste stable pendant un chargement ou après une erreur.
  const [knownEvents, setKnownEvents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  // Copie de l'élément affiché : le détail reste visible même si, après un
  // changement de statut, il ne correspond plus au filtre de la liste.
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusBusy, setStatusBusy] = useState("");
  const [feedback, setFeedback] = useState(null);
  const detailRef = useRef(null);
  const listPanelRef = useRef(null);

  // Recherche avec anti-rebond.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === search) return undefined;
    const timer = setTimeout(() => { setSearch(value); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    const controller = new AbortController();
    eventParticipationService.list({
      search: search || undefined,
      status: status === "all" ? undefined : status,
      event: typeFilter === "all" ? undefined : typeFilter,
      page,
      limit: 25,
    }, { signal: controller.signal })
      .then(({ data }) => {
        setResult({ key: requestKey, filterKey, data, error: "" });
        setKnownEvents(Array.isArray(data?.events) ? data.events : []);
        if (page > (data?.pagination?.totalPages || 1)) setPage(data.pagination.totalPages || 1);
      })
      .catch((error) => {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") return;
        // Les anciennes lignes ne restent affichées que pour un simple
        // rafraîchissement des mêmes filtres : jamais sous un autre filtre.
        setResult((previous) => ({
          key: requestKey,
          filterKey,
          data: previous.filterKey === filterKey ? previous.data : null,
          error: clientErrorMessage(error) || ta("loadError"),
        }));
      });
    return () => controller.abort();
    // `ta` est stable pour une langue donnée ; requestKey décrit entièrement la requête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const loading = result.key !== requestKey;
  const data = result.data;
  const requests = useMemo(() => data?.requests || [], [data]);
  const counts = data?.counts || { all: 0, new: 0, contacted: 0, confirmed: 0 };
  const pagination = data?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 };
  const selected = requests.find((item) => item._id === selectedId)
    || (selectedItem?._id === selectedId ? selectedItem : null);
  const hasFilters = Boolean(search) || status !== "all" || typeFilter !== "all";
  const from = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);

  // Demande de participation : événement choisi, prochains événements ou aucun.
  const interestLabel = (item) => {
    if (item.eventTitle) return item.eventTitle;
    return item.notifyUpcoming ? ta("interestUpcoming") : ta("interestNone");
  };
  // Valeur absente : « Non renseigné ».
  const factValue = (value, props = {}) => (value
    ? <dd {...props}>{value}</dd>
    : <dd className="apr-facts__empty">{ta("notProvided")}</dd>);

  const selectRequest = (item) => {
    setSelectedId(item._id);
    setSelectedItem(item);
    // Sur petit écran, le détail s'affiche sous la liste : on l'amène à l'écran.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1100px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Fermer le détail ramène le focus sur la ligne correspondante.
  const closeDetail = () => {
    const id = selectedId;
    setSelectedId("");
    requestAnimationFrame(() => {
      const row = listPanelRef.current?.querySelector(`[data-request-id="${id}"]`);
      (row || listPanelRef.current)?.focus();
    });
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setTypeFilter("all");
    setPage(1);
  };

  const changeStatus = async (item, nextStatus) => {
    if (statusBusy || normalizeRequestStatus(item.status) === nextStatus) return;
    setStatusBusy(nextStatus);
    try {
      const { data: response } = await eventParticipationService.updateStatus(item._id, nextStatus);
      setResult((previous) => ({
        ...previous,
        data: previous.data ? {
          ...previous.data,
          requests: previous.data.requests.map((entry) => (entry._id === item._id ? response.request : entry)),
        } : previous.data,
      }));
      setSelectedItem(response.request);
      setFeedback({ type: "success", message: t("requestStatus.updated", { status: t(`requestStatus.${nextStatus}`) }) });
      setReloadKey((value) => value + 1); // compteurs à jour
    } catch {
      setFeedback({ type: "error", message: t("requestStatus.updateError") });
    } finally {
      setStatusBusy("");
    }
  };

  const renderList = () => {
    if (!data && loading) {
      return (
        <div className="apr-state" role="status">
          <LoaderCircle className="apr-spin" size={22} aria-hidden="true" />
          <span>{ta("loading")}</span>
        </div>
      );
    }
    if (!data && result.error) {
      return (
        <div className="apr-state apr-state--error" role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <span>{result.error}</span>
          <button type="button" className="btn btn-primary" onClick={() => setReloadKey((value) => value + 1)}>{ta("retry")}</button>
        </div>
      );
    }
    if (!requests.length) {
      return hasFilters ? (
        <div className="apr-state" role="status">
          <span className="apr-state__icon"><SearchX size={24} aria-hidden="true" /></span>
          <strong>{ta("emptyFilteredTitle")}</strong>
          <span>{ta("emptyFilteredText")}</span>
          <button type="button" className="btn btn-ghost" onClick={resetFilters}>{ta("resetFilters")}</button>
        </div>
      ) : (
        <div className="apr-state" role="status">
          <span className="apr-state__icon"><Inbox size={24} aria-hidden="true" /></span>
          <strong>{ta("emptyTitle")}</strong>
          <span>{ta("emptyText")}</span>
        </div>
      );
    }
    return (
      <ul className="apr-list" aria-label={ta("listLabel")}>
        {requests.map((item) => {
          const contact = isContactMessage(item);
          const TypeIcon = typeIconOf(item);
          const none = !contact && !item.eventTitle && !item.notifyUpcoming;
          return (
            <li key={item._id}>
              <button
                type="button"
                className={`apr-row ${item._id === selectedId ? "apr-row--active" : ""}`}
                data-request-id={item._id}
                onClick={() => selectRequest(item)}
                aria-pressed={item._id === selectedId}
              >
                <span className="apr-avatar" aria-hidden="true">{initials(item.firstName, item.lastName) || <UserRound size={16} />}</span>
                <span className="apr-row__main">
                  <strong>{item.firstName} {item.lastName}</strong>
                  <small dir="ltr">{item.email}</small>
                </span>
                <span className={`apr-row__event ${none ? "apr-row__event--none" : ""}`}>
                  <TypeIcon size={14} aria-hidden="true" />
                  <span dir={contact ? "auto" : undefined}>{contact ? item.subject || ta("sourceContact") : interestLabel(item)}</span>
                </span>
                <span className="apr-row__date">{formatDate(item.createdAt, false)}</span>
                <RequestStatusBadge status={item.status} className="apr-row__status" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderDetail = () => {
    const contact = isContactMessage(selected);
    return (
      <>
        <header className="apr-detail__head">
          <span className="apr-avatar apr-avatar--lg" aria-hidden="true">{initials(selected.firstName, selected.lastName) || <UserRound size={20} />}</span>
          <div>
            <h2>{selected.firstName} {selected.lastName}</h2>
            <div className="apr-detail__tags">
              <RequestStatusBadge status={selected.status} />
              <span className="apr-kind">
                {contact ? <MessageSquareText size={13} aria-hidden="true" /> : <CalendarDays size={13} aria-hidden="true" />}
                {contact ? ta("typeContact") : ta("kindParticipation")}
              </span>
            </div>
          </div>
          <button type="button" className="apr-detail__close" onClick={closeDetail} aria-label={ta("close")}><X size={16} aria-hidden="true" /></button>
        </header>

        <div className="apr-detail__actions">
          {contact ? (
            <a className="btn btn-ghost" href={replyMailtoHref(selected, ta("replyPrefix"))}><Reply className="apr-flip" size={16} aria-hidden="true" />{ta("replyEmail")}</a>
          ) : (
            <>
              <a className="btn btn-ghost" href={replyMailtoHref(selected, ta("replyPrefix"))}><Mail size={16} aria-hidden="true" />{ta("contactEmail")}</a>
              {selected.phone && (
                <a className="btn btn-ghost" href={`tel:${selected.phone.replace(/\s/g, "")}`}><Phone size={16} aria-hidden="true" />{ta("contactPhone")}</a>
              )}
            </>
          )}
        </div>

        {contact ? (
          <>
            <section className="apr-message" aria-label={ta("fields.message")}>
              <span className="apr-message__label"><MessageSquareText size={14} aria-hidden="true" />{ta("fields.subject")}</span>
              <h3 dir="auto">{selected.subject || "—"}</h3>
              <span className="apr-message__label">{ta("fields.message")}</span>
              {/* Zone défilante : atteignable au clavier pour lire un long message. */}
              <p dir="auto" tabIndex={0}>{selected.message || "—"}</p>
            </section>
            <dl className="apr-facts">
              <div><dt><Mail size={14} aria-hidden="true" />{ta("fields.email")}</dt><dd dir="ltr"><BreakableEmail email={selected.email} /></dd></div>
              <div><dt><CalendarClock size={14} aria-hidden="true" />{ta("fields.receivedAt")}</dt><dd>{formatDate(selected.createdAt)}</dd></div>
            </dl>
          </>
        ) : (
          <dl className="apr-facts">
            <div><dt><Mail size={14} aria-hidden="true" />{ta("fields.email")}</dt><dd dir="ltr">{selected.email}</dd></div>
            <div><dt><Phone size={14} aria-hidden="true" />{ta("fields.phone")}</dt>{factValue(selected.phone, { dir: "ltr" })}</div>
            <div><dt><School size={14} aria-hidden="true" />{ta("fields.university")}</dt>{factValue(selected.university)}</div>
            <div><dt><GraduationCap size={14} aria-hidden="true" />{ta("fields.studyLevel")}</dt>{factValue(studyLevelLabel(selected.studyLevel, t))}</div>
            <div className="apr-facts__wide">
              <dt><CalendarDays size={14} aria-hidden="true" />{ta("fields.event")}</dt>
              <dd>
                {interestLabel(selected)}
                {selected.eventStartsAt && <small>{formatDate(selected.eventStartsAt)}</small>}
              </dd>
            </div>
            <div className="apr-facts__wide"><dt><CalendarClock size={14} aria-hidden="true" />{ta("fields.submittedAt")}</dt><dd>{formatDate(selected.createdAt)}</dd></div>
          </dl>
        )}

        <RequestStatusPicker
          className="apr-detail__status"
          value={selected.status}
          busyStatus={statusBusy}
          onChange={(nextStatus) => changeStatus(selected, nextStatus)}
          meta={selected.statusUpdatedAt
            ? t("requestStatus.updatedBy", { name: selected.statusUpdatedBy?.name || "—", date: formatDate(selected.statusUpdatedAt) })
            : null}
        />
      </>
    );
  };

  return (
    <DashboardLayout title={ta("title")} subtitle={ta("subtitle")}>
      <div className="apr-page">
        <section className="apr-toolbar" aria-label={ta("filtersLabel")}>
          <RequestStatusFilter value={status} counts={counts} onChange={(key) => { setStatus(key); setPage(1); }} />
          <div className="apr-filters">
            <label className="apr-search">
              <span className="apr-sr-only">{ta("searchLabel")}</span>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value.slice(0, 100))}
                placeholder={ta("searchPlaceholder")}
              />
              {searchInput && (
                <button type="button" onClick={() => setSearchInput("")} aria-label={t("common.clearSearch")}><X size={14} aria-hidden="true" /></button>
              )}
            </label>
            <label className="apr-select">
              <span className="apr-sr-only">{ta("typeFilter")}</span>
              <ListFilter size={16} aria-hidden="true" />
              <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
                <option value="all">{ta("typeAll")}</option>
                <option value="contact">{ta("typeContact")}</option>
                <option value="participation">{ta("typeParticipation")}</option>
                {knownEvents.length > 0 && (
                  <optgroup label={ta("typeEvents")}>
                    {knownEvents.map((item) => (
                      <option key={item._id} value={item._id}>{item.title || "—"} ({item.count})</option>
                    ))}
                  </optgroup>
                )}
                <option value="upcoming">{ta("typeUpcoming")}</option>
                <option value="none">{ta("typeNone")}</option>
              </select>
            </label>
            <button type="button" className="btn btn-ghost apr-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={16} className={loading && data ? "apr-spin" : ""} aria-hidden="true" />
              {ta("refresh")}
            </button>
          </div>
        </section>

        {/* Résultat d'un changement de statut : zone toujours présente, annoncée
            par les lecteurs d'écran ; le bandeau visible en est la copie. */}
        <p className="apr-sr-only" role="status" aria-live="polite">{feedback?.message || ""}</p>
        {feedback && (
          <div className={`apr-feedback apr-feedback--${feedback.type}`} aria-hidden="true">
            {feedback.type === "error" ? <CircleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
            {feedback.message}
          </div>
        )}
        {data && result.error && (
          <div className="apr-feedback apr-feedback--error" role="alert"><CircleAlert size={16} aria-hidden="true" />{result.error}</div>
        )}

        <div className="apr-layout">
          <section className="apr-panel" aria-busy={loading} ref={listPanelRef} tabIndex={-1}>
            {renderList()}
            {data && pagination.total > 0 && (
              <nav className="apr-pagination" aria-label={ta("paginationLabel")}>
                <span aria-live="polite">{ta("range", { from, to, total: pagination.total })}</span>
                <div>
                  <button type="button" className="btn btn-ghost" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} aria-label={ta("previous")}>
                    <ChevronLeft className="apr-flip" size={16} aria-hidden="true" />
                  </button>
                  <span className="apr-pagination__page">{pagination.page} / {pagination.totalPages}</span>
                  <button type="button" className="btn btn-ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)} aria-label={ta("next")}>
                    <ChevronRight className="apr-flip" size={16} aria-hidden="true" />
                  </button>
                </div>
              </nav>
            )}
          </section>

          <aside className="apr-panel apr-detail" ref={detailRef} aria-label={ta("detailTitle")}>
            {selected ? renderDetail() : (
              <div className="apr-state apr-state--compact">
                <span className="apr-state__icon"><MessageSquareText size={22} aria-hidden="true" /></span>
                <span>{ta("selectHint")}</span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
