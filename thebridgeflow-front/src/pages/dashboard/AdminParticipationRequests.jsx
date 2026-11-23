import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, X, RefreshCw, Mail, Phone, CalendarDays, CalendarClock, GraduationCap, School, Inbox, SearchX,
  CircleAlert, ChevronLeft, ChevronRight, LoaderCircle, UserRound, Sparkles, CircleDashed, PhoneCall, CircleCheck,
  MessageSquareText,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { eventParticipationService } from "../../services/eventParticipation.service.js";
import { PARTICIPATION_STATUSES } from "../../utils/eventParticipation.js";
import "./AdminParticipationRequests.css";

const LOCALES = { fr: "fr-FR", en: "en-GB", ar: "ar-TN" };
const STATUS_META = {
  new: { Icon: CircleDashed, tone: "blue" },
  contacted: { Icon: PhoneCall, tone: "amber" },
  confirmed: { Icon: CircleCheck, tone: "emerald" },
};
const SEARCH_DEBOUNCE_MS = 350;
// Ancien message du formulaire de contact (repris par la migration).
const isLegacy = (item) => item?.source === "contact";

function initials(first = "", last = "") {
  return `${first.trim()[0] || ""}${last.trim()[0] || ""}`.toUpperCase();
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || STATUS_META.new;
  const Icon = meta.Icon;
  return (
    <span className={`apr-badge apr-tone--${meta.tone}`}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {t(`adminParticipation.statuses.${status}`)}
    </span>
  );
}

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
  const [eventFilter, setEventFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const filterKey = JSON.stringify([search, status, eventFilter, page]);
  const requestKey = JSON.stringify([filterKey, reloadKey]);
  const [result, setResult] = useState({ key: null, filterKey: null, data: null, error: "" });
  const [selectedId, setSelectedId] = useState("");
  // Copie de la demande affichée : le détail reste visible même si, après un
  // changement de statut, elle ne correspond plus au filtre de la liste.
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
      event: eventFilter === "all" ? undefined : eventFilter,
      page,
      limit: 25,
    }, { signal: controller.signal })
      .then(({ data }) => {
        setResult({ key: requestKey, filterKey, data, error: "" });
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
          error: error?.response?.data?.message || ta("loadError"),
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
  const hasFilters = Boolean(search) || status !== "all" || eventFilter !== "all";
  const from = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);

  const interestLabel = (item) => {
    if (isLegacy(item)) return ta("sourceContact");
    if (item.eventTitle) return item.eventTitle;
    return item.notifyUpcoming ? ta("interestUpcoming") : ta("interestNone");
  };
  // Valeur absente (ancien message du site) : « Non renseigné ».
  const factValue = (value, props = {}) => (value
    ? <dd {...props}>{value}</dd>
    : <dd className="apr-facts__empty">{ta("notProvided")}</dd>);
  // E-mail encodé (aucun paramètre injecté) ; réponse à un ancien message : « Re : objet ».
  const mailtoHref = (item) => {
    const address = encodeURIComponent(item.email).replace(/%40/g, "@");
    return isLegacy(item) && item.subject
      ? `mailto:${address}?subject=${encodeURIComponent(`${ta("replyPrefix")} ${item.subject}`)}`
      : `mailto:${address}`;
  };

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
    setEventFilter("all");
    setPage(1);
  };

  const changeStatus = async (item, nextStatus) => {
    if (statusBusy || item.status === nextStatus) return;
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
      setFeedback({ type: "success", message: ta("statusUpdated", { status: ta(`statuses.${nextStatus}`) }) });
      setReloadKey((value) => value + 1); // compteurs à jour
    } catch (error) {
      setFeedback({ type: "error", message: error?.response?.data?.message || ta("statusError") });
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
        <div className="apr-state">
          <span className="apr-state__icon"><SearchX size={24} aria-hidden="true" /></span>
          <strong>{ta("emptyFilteredTitle")}</strong>
          <span>{ta("emptyFilteredText")}</span>
          <button type="button" className="btn btn-ghost" onClick={resetFilters}>{ta("resetFilters")}</button>
        </div>
      ) : (
        <div className="apr-state">
          <span className="apr-state__icon"><Inbox size={24} aria-hidden="true" /></span>
          <strong>{ta("emptyTitle")}</strong>
          <span>{ta("emptyText")}</span>
        </div>
      );
    }
    return (
      <ul className="apr-list" aria-label={ta("listLabel")}>
        {requests.map((item) => (
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
              <span className={`apr-row__event ${isLegacy(item) ? "apr-row__event--legacy" : ""}`}>
                {isLegacy(item) ? <MessageSquareText size={14} aria-hidden="true" />
                  : item.eventTitle ? <CalendarDays size={14} aria-hidden="true" />
                    : item.notifyUpcoming ? <Sparkles size={14} aria-hidden="true" /> : null}
                <span>{isLegacy(item) && item.subject ? item.subject : interestLabel(item)}</span>
              </span>
              <span className="apr-row__date">{formatDate(item.createdAt, false)}</span>
              <StatusBadge status={item.status} />
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <DashboardLayout title={ta("title")} subtitle={ta("subtitle")}>
      <div className="apr-page">
        <section className="apr-toolbar" aria-label={ta("filtersLabel")}>
          <div className="apr-chips" role="group" aria-label={ta("statusFilter")}>
            {["all", ...PARTICIPATION_STATUSES].map((key) => (
              <button
                key={key}
                type="button"
                className={`apr-chip ${key !== "all" ? `apr-tone--${STATUS_META[key].tone}` : ""}`}
                aria-pressed={status === key}
                onClick={() => { setStatus(key); setPage(1); }}
              >
                {ta(`statuses.${key}`)}
                <span className="apr-chip__count">{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>
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
              <span className="apr-sr-only">{ta("eventFilter")}</span>
              <CalendarDays size={16} aria-hidden="true" />
              <select value={eventFilter} onChange={(event) => { setEventFilter(event.target.value); setPage(1); }}>
                <option value="all">{ta("eventAll")}</option>
                {(data?.events || []).map((item) => (
                  <option key={item._id} value={item._id}>{item.title || "—"} ({item.count})</option>
                ))}
                <option value="upcoming">{ta("eventUpcoming")}</option>
                <option value="none">{ta("eventNone")}</option>
                <option value="contact">{ta("eventContact")}</option>
              </select>
            </label>
            <button type="button" className="btn btn-ghost apr-refresh" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
              <RefreshCw size={16} className={loading && data ? "apr-spin" : ""} aria-hidden="true" />
              {ta("refresh")}
            </button>
          </div>
        </section>

        {feedback && (
          <div className={`apr-feedback apr-feedback--${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
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
                <span>{ta("range", { from, to, total: pagination.total })}</span>
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
            {selected ? (
              <>
                <header className="apr-detail__head">
                  <span className="apr-avatar apr-avatar--lg" aria-hidden="true">{initials(selected.firstName, selected.lastName)}</span>
                  <div>
                    <h2>{selected.firstName} {selected.lastName}</h2>
                    <StatusBadge status={selected.status} />
                  </div>
                  <button type="button" className="apr-detail__close" onClick={closeDetail} aria-label={ta("close")}><X size={16} aria-hidden="true" /></button>
                </header>
                <div className="apr-detail__actions">
                  <a className="btn btn-ghost" href={mailtoHref(selected)}><Mail size={16} aria-hidden="true" />{ta("contactEmail")}</a>
                  {selected.phone && (
                    <a className="btn btn-ghost" href={`tel:${selected.phone.replace(/\s/g, "")}`}><Phone size={16} aria-hidden="true" />{ta("contactPhone")}</a>
                  )}
                </div>
                {isLegacy(selected) && (
                  <section className="apr-message" aria-label={ta("fields.message")}>
                    <span className="apr-message__label"><MessageSquareText size={14} aria-hidden="true" />{ta("fields.subject")}</span>
                    <h3>{selected.subject || "—"}</h3>
                    <span className="apr-message__label">{ta("fields.message")}</span>
                    <p>{selected.message || "—"}</p>
                    <small>{ta("legacyNote")}</small>
                  </section>
                )}
                <dl className="apr-facts">
                  <div><dt><Mail size={14} aria-hidden="true" />{ta("fields.email")}</dt><dd dir="ltr">{selected.email}</dd></div>
                  <div><dt><Phone size={14} aria-hidden="true" />{ta("fields.phone")}</dt>{factValue(selected.phone, { dir: "ltr" })}</div>
                  <div><dt><School size={14} aria-hidden="true" />{ta("fields.university")}</dt>{factValue(selected.university)}</div>
                  <div><dt><GraduationCap size={14} aria-hidden="true" />{ta("fields.studyLevel")}</dt>{factValue(selected.studyLevel && t(`eventParticipation.levels.${selected.studyLevel}`))}</div>
                  <div className="apr-facts__wide">
                    <dt><CalendarDays size={14} aria-hidden="true" />{ta("fields.event")}</dt>
                    <dd>
                      {interestLabel(selected)}
                      {selected.eventStartsAt && <small>{formatDate(selected.eventStartsAt)}</small>}
                    </dd>
                  </div>
                  <div className="apr-facts__wide"><dt><CalendarClock size={14} aria-hidden="true" />{ta("fields.submittedAt")}</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                </dl>
                <div className="apr-status">
                  <span className="apr-status__label" id="apr-status-label">{ta("statusLabel")}</span>
                  <div className="apr-status__options" role="group" aria-labelledby="apr-status-label">
                    {PARTICIPATION_STATUSES.map((key) => {
                      const Icon = STATUS_META[key].Icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`apr-status__option apr-tone--${STATUS_META[key].tone}`}
                          aria-pressed={selected.status === key}
                          disabled={Boolean(statusBusy)}
                          onClick={() => changeStatus(selected, key)}
                        >
                          {statusBusy === key ? <LoaderCircle className="apr-spin" size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
                          {ta(`statuses.${key}`)}
                        </button>
                      );
                    })}
                  </div>
                  {selected.statusUpdatedAt && (
                    <small className="apr-status__meta">
                      {ta("updatedBy", { name: selected.statusUpdatedBy?.name || "—", date: formatDate(selected.statusUpdatedAt) })}
                    </small>
                  )}
                </div>
              </>
            ) : (
              <div className="apr-state apr-state--compact">
                <span className="apr-state__icon"><UserRound size={22} aria-hidden="true" /></span>
                <span>{ta("selectHint")}</span>
              </div>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
