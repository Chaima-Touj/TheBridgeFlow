import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, X, ArrowRight, ChevronLeft, ChevronRight, RotateCw, TriangleAlert, Users,
  SearchX, CalendarClock, CircleAlert, ArrowUpDown,
} from "lucide-react";
import { candidatesService } from "../../../services/candidates.service.js";
import { ICON_SIZE, ICON_STROKE, STUDENT_FILTERS, STUDENT_PAGE_SIZES, STUDENT_SORTS } from "./candidatesConfig.js";
import {
  formatDate, formatDateTime, formatRelative, isCanceledError, isNetworkError, resolveLocale,
} from "./candidatesUtils.js";
import CandidateAvatar from "./shared/CandidateAvatar.jsx";
import { GlobalStatusBadge } from "./shared/StatusBadges.jsx";
import EmptyState from "./shared/EmptyState.jsx";
import Skeleton from "./shared/Skeleton.jsx";

const DEFAULTS = { q: "", filtre: "all", page: "1", limit: "10", tri: "recent" };
const SEARCH_DEBOUNCE_MS = 350;

function readParams(searchParams) {
  const filter = searchParams.get("filtre");
  const sort = searchParams.get("tri");
  const limit = Number(searchParams.get("limit"));
  const page = Number(searchParams.get("page"));
  return {
    q: (searchParams.get("q") || "").slice(0, 100),
    filter: STUDENT_FILTERS.some((item) => item.key === filter) ? filter : "all",
    sort: STUDENT_SORTS.includes(sort) ? sort : "recent",
    limit: STUDENT_PAGE_SIZES.includes(limit) ? limit : 10,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

function getPageNumbers(current, total) {
  const range = [];
  for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i += 1) range.push(i);
  if (range[0] > 1) {
    if (range[0] > 2) range.unshift("ellipsis-start");
    range.unshift(1);
  }
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) range.push("ellipsis-end");
    range.push(total);
  }
  return range;
}

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 0.8, 0.24, 1] } },
};

function SkeletonRows({ count }) {
  return (
    <ul className="cnd-list-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="cnd-list-row cnd-list-row--skeleton">
          <div className="cnd-list-cell cnd-list-cell--student">
            <Skeleton width={40} height={40} circle />
            <span className="cnd-list-skel-lines"><Skeleton width="70%" height={13} /><Skeleton width="50%" height={11} /></span>
          </div>
          <div className="cnd-list-cell"><Skeleton width="80%" height={22} /></div>
          <div className="cnd-list-cell cnd-list-cell--activity"><Skeleton width="60%" height={12} /></div>
          <div className="cnd-list-cell"><Skeleton width={110} height={22} /></div>
          <div className="cnd-list-cell cnd-list-cell--tasks"><Skeleton width="55%" height={12} /></div>
          <div className="cnd-list-cell cnd-list-cell--action"><Skeleton width={36} height={32} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function StudentsView({ searchParams, setSearchParams }) {
  const { t, i18n } = useTranslation();
  const tl = (key, options) => t(`adminCandidates.list.students.${key}`, options);
  const tc = (key, options) => t(`adminCandidates.common.${key}`, options);
  const location = useLocation();
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const { q, filter, sort, limit, page } = readParams(searchParams);

  const [searchInput, setSearchInput] = useState(q);
  // Navigation (précédent/suivant) qui change ?q= : le champ suit l'URL.
  const [syncedQ, setSyncedQ] = useState(q);
  if (syncedQ !== q) {
    setSyncedQ(q);
    if (searchInput.trim() !== q) setSearchInput(q);
  }
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = JSON.stringify([q, filter, sort, limit, page, reloadToken]);
  const [result, setResult] = useState({ key: null, data: null, error: "" });

  const updateParams = useCallback((patch, options = {}) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        const text = value === null || value === undefined ? "" : String(value);
        if (!text || DEFAULTS[key] === text) next.delete(key);
        else next.set(key, text);
      }
      return next;
    }, options);
  }, [setSearchParams]);

  // Recherche avec anti-rebond : l'URL (et donc la requête) ne change qu'après 350 ms.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === q) return undefined;
    const timer = setTimeout(() => updateParams({ q: value, page: 1 }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, q, updateParams]);

  useEffect(() => {
    const controller = new AbortController();
    candidatesService.list({ search: q, filter, sort, page, limit }, { signal: controller.signal })
      .then(({ data }) => {
        setResult({ key: requestKey, data, error: "" });
        const totalPages = data?.pagination?.totalPages || 1;
        if (page > totalPages) updateParams({ page: totalPages }, { replace: true });
      })
      .catch((error) => {
        if (isCanceledError(error)) return;
        const message = isNetworkError(error)
          ? tc("errors.network")
          : error?.response?.status === 429 ? tc("errors.rateLimited") : tl("loadError");
        setResult((previous) => ({ key: requestKey, data: previous.data, error: message }));
      });
    return () => controller.abort();
    // `t` est stable pour une langue donnée ; la requête dépend uniquement de requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = result.key !== requestKey;
  const data = result.data;
  const students = data?.students || [];
  const counts = data?.counts || {};
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1 };
  const hasCriteria = Boolean(q) || filter !== "all";
  const from = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const to = Math.min(pagination.total, pagination.page * pagination.limit);

  const resetFilters = () => {
    setSearchInput("");
    updateParams({ q: "", filtre: "all", page: 1 });
  };

  const renderBody = () => {
    if (!data && loading) return <SkeletonRows count={Math.min(limit, 6)} />;
    if (!data && result.error) {
      return (
        <div className="cnd-list-state">
          <div className="cnd-alert cnd-tone--red" role="alert">
            <TriangleAlert size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="cnd-alert__body">{result.error}</span>
            <button type="button" className="cnd-btn cnd-btn--secondary cnd-btn--sm" onClick={() => setReloadToken((value) => value + 1)}>
              <RotateCw size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {tc("actions.retry")}
            </button>
          </div>
        </div>
      );
    }
    if (!students.length) {
      return hasCriteria ? (
        <EmptyState
          icon={SearchX}
          title={tl("emptyFilteredTitle")}
          description={tl("emptyFilteredText")}
          action={<button type="button" className="cnd-btn cnd-btn--secondary" onClick={resetFilters}>{tl("resetFilters")}</button>}
        />
      ) : (
        <EmptyState icon={Users} title={tl("emptyTitle")} description={tl("emptyText")} />
      );
    }
    return (
      <motion.ul
        key={result.key}
        className="cnd-list-rows"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {students.map((student) => {
          const extraOffers = Math.max(0, student.applicationsCount - student.offers.length);
          const shownOffers = student.offers.slice(0, 2);
          const hiddenOffers = extraOffers + Math.max(0, student.offers.length - shownOffers.length);
          return (
            <motion.li key={student._id} className="cnd-list-row" variants={rowVariants}>
              <div className="cnd-list-cell cnd-list-cell--student">
                <CandidateAvatar name={student.name} avatarUrl={student.avatarUrl} size="md" />
                <span className="cnd-list-student">
                  <Link
                    to={`/dashboard/admin/candidatures/etudiants/${student._id}`}
                    state={{ from: location.search }}
                    className="cnd-list-row__link"
                  >
                    {student.name || "—"}
                  </Link>
                  <span className="cnd-list-student__email cnd-ltr">{student.email}</span>
                </span>
              </div>

              <div className="cnd-list-cell cnd-list-cell--apps">
                <span className="cnd-list-cell__label">{tl("colApplications")}</span>
                <span className="cnd-list-apps">
                  <span className={`cnd-list-apps__count ${student.applicationsCount > 1 ? "cnd-list-apps__count--multi" : ""}`}>
                    {tc("applicationsCount", { count: student.applicationsCount })}
                  </span>
                  <span className="cnd-list-apps__offers">
                    {shownOffers.map((offer) => (
                      <span key={offer.applicationId} className="cnd-list-offer" title={[offer.title || tc("deletedOffer"), offer.companyName].filter(Boolean).join(" — ")}>
                        {offer.title || tc("deletedOffer")}
                      </span>
                    ))}
                    {hiddenOffers > 0 && <span className="cnd-list-offer cnd-list-offer--more">+{hiddenOffers}</span>}
                  </span>
                </span>
              </div>

              <div className="cnd-list-cell cnd-list-cell--activity">
                <span className="cnd-list-cell__label">{tl("colLastActivity")}</span>
                <span className="cnd-list-activity">
                  {formatRelative(student.lastActivityAt, locale)}
                  <small>{formatDate(student.lastActivityAt, locale)}</small>
                </span>
              </div>

              <div className="cnd-list-cell cnd-list-cell--status">
                <span className="cnd-list-cell__label">{tl("colStatus")}</span>
                <span className="cnd-list-status">
                  <GlobalStatusBadge status={student.globalStatus} />
                  {student.upcomingInterviewAt && (
                    <span className="cnd-list-status__hint">
                      <CalendarClock size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />
                      {formatDateTime(student.upcomingInterviewAt, locale)}
                    </span>
                  )}
                </span>
              </div>

              <div className="cnd-list-cell cnd-list-cell--tasks">
                <span className="cnd-list-cell__label">{tl("colTasks")}</span>
                {student.tasks.open > 0 ? (
                  <span className="cnd-list-tasks">
                    <span className="cnd-list-tasks__open">
                      {student.tasks.overdue > 0 && <span className="cnd-list-tasks__dot" aria-hidden="true" />}
                      {tc("openTasks", { count: student.tasks.open })}
                    </span>
                    {student.tasks.overdue > 0 ? (
                      <span className="cnd-list-tasks__overdue">
                        <CircleAlert size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />
                        {tc("overdueTasks", { count: student.tasks.overdue })}
                      </span>
                    ) : student.tasks.nextDueAt ? (
                      <span className="cnd-list-tasks__next">{tl("nextDue", { date: formatDate(student.tasks.nextDueAt, locale) })}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="cnd-list-tasks cnd-list-tasks--none">{tl("noOpenTask")}</span>
                )}
              </div>

              <div className="cnd-list-cell cnd-list-cell--action" aria-hidden="true">
                <span className="cnd-list-open">
                  <span className="cnd-list-open__text">{tc("actions.openDossier")}</span>
                  <ArrowRight className="cnd-flip-rtl" size={ICON_SIZE} strokeWidth={ICON_STROKE} />
                </span>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    );
  };

  return (
    <div className="cnd-card cnd-list-panel" aria-busy={loading}>
      {loading && data && <div className="cnd-list-progress" aria-hidden="true" />}

      <div className="cnd-list-toolbar">
        <label className="cnd-search cnd-list-search">
          <span className="cnd-sr-only">{tl("searchLabel")}</span>
          <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <input
            type="search"
            className="cnd-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value.slice(0, 100))}
            placeholder={tl("searchPlaceholder")}
            autoComplete="off"
          />
          {searchInput && (
            <button type="button" className="cnd-list-search__clear" onClick={() => setSearchInput("")} aria-label={tl("clearSearch")}>
              <X size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="cnd-list-toolbar__selects">
          <label className="cnd-list-select">
            <ArrowUpDown size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span className="cnd-sr-only">{tl("sortLabel")}</span>
            <select className="cnd-select" value={sort} onChange={(event) => updateParams({ tri: event.target.value, page: 1 })}>
              {STUDENT_SORTS.map((key) => <option key={key} value={key}>{tl(`sort.${key}`)}</option>)}
            </select>
          </label>
          <label className="cnd-list-select">
            <span className="cnd-list-select__prefix">{tl("pageSizeLabel")}</span>
            <select className="cnd-select" value={limit} onChange={(event) => updateParams({ limit: event.target.value, page: 1 })}>
              {STUDENT_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="cnd-list-chips" role="group" aria-label={tl("filtersLabel")}>
        {STUDENT_FILTERS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            className={`cnd-chip ${key === "overdue" && counts.overdue > 0 ? "cnd-chip--danger" : ""}`}
            aria-pressed={filter === key}
            onClick={() => updateParams({ filtre: key, page: 1 })}
          >
            <Icon size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {tc(`filters.${key}`)}
            {data && <span className="cnd-chip__count cnd-num">{counts[key] ?? 0}</span>}
          </button>
        ))}
      </div>

      {data && result.error && (
        <div className="cnd-alert cnd-tone--red cnd-list-inline-error" role="alert">
          <TriangleAlert size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
          <span className="cnd-alert__body">{result.error}</span>
          <button type="button" className="cnd-btn cnd-btn--secondary cnd-btn--sm" onClick={() => setReloadToken((value) => value + 1)}>
            {tc("actions.retry")}
          </button>
        </div>
      )}

      <div className="cnd-list-header" aria-hidden="true">
        <span>{tl("colStudent")}</span>
        <span>{tl("colApplications")}</span>
        <span className="cnd-list-header__activity">{tl("colLastActivity")}</span>
        <span>{tl("colStatus")}</span>
        <span className="cnd-list-header__tasks">{tl("colTasks")}</span>
        <span />
      </div>

      {renderBody()}

      {data && pagination.total > 0 && (
        <nav className="cnd-list-pagination" aria-label={tl("paginationLabel")}>
          <span className="cnd-list-pagination__info cnd-num">{tl("range", { from, to, total: pagination.total })}</span>
          <div className="cnd-list-pagination__pages">
            <button
              type="button"
              className="cnd-btn cnd-btn--ghost cnd-btn--sm cnd-btn--icon"
              disabled={pagination.page <= 1}
              onClick={() => updateParams({ page: pagination.page - 1 })}
              aria-label={tl("previousPage")}
            >
              <ChevronLeft className="cnd-flip-rtl" size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
            {getPageNumbers(pagination.page, pagination.totalPages).map((item) => (
              typeof item === "string" ? (
                <span key={item} className="cnd-list-pagination__ellipsis" aria-hidden="true">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`cnd-list-page ${item === pagination.page ? "cnd-list-page--active" : ""}`}
                  aria-current={item === pagination.page ? "page" : undefined}
                  onClick={() => updateParams({ page: item })}
                >
                  {item}
                </button>
              )
            ))}
            <button
              type="button"
              className="cnd-btn cnd-btn--ghost cnd-btn--sm cnd-btn--icon"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateParams({ page: pagination.page + 1 })}
              aria-label={tl("nextPage")}
            >
              <ChevronRight className="cnd-flip-rtl" size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
