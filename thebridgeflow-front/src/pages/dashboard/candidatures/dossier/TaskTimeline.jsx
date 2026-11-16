import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, History, RotateCcw, Plus, ClipboardList, SearchX } from "lucide-react";
import { TASK_TYPES, ICON_SIZE, ICON_STROKE } from "../candidatesConfig.js";
import { groupTimelineByDay, isTaskOverdue, mergeTimeline } from "../candidatesUtils.js";
import EmptyState from "../shared/EmptyState.jsx";
import { TaskItem, SystemItem } from "./TimelineItems.jsx";
import {
  DEFAULT_TIMELINE_FILTERS, TIMELINE_STATUS_FILTERS, filterSystemEvents, filterTasks, hasActiveFilters, relativeDayKind,
} from "./dossierUtils.js";

export default function TaskTimeline({
  tasks, systemEvents, applications, filters, onFiltersChange, now, locale, currentUserId,
  busyTaskId, highlightId, onStatusChange, onEdit, onDelete, onAddTask,
}) {
  const { t } = useTranslation();
  const tt = (key, options) => t(`adminCandidates.dossier.timeline.${key}`, options);
  const setFilter = (patch) => onFiltersChange({ ...filters, ...patch });

  const statusCounts = useMemo(() => ({
    all: tasks.length,
    pending: tasks.filter((task) => task.status === "pending").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    overdue: tasks.filter((task) => isTaskOverdue(task, now)).length,
  }), [tasks, now]);

  const groups = useMemo(() => {
    const visibleTasks = filterTasks(tasks, filters, now);
    const visibleEvents = filterSystemEvents(systemEvents, filters);
    return groupTimelineByDay(mergeTimeline(visibleTasks, visibleEvents, filters.order));
  }, [tasks, systemEvents, filters, now]);

  const dayLabel = (date) => {
    const kind = relativeDayKind(date, now);
    if (kind) return tt(`day.${kind}`);
    return new Date(date).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const active = hasActiveFilters(filters);
  const nothingAtAll = !tasks.length && !systemEvents.length;
  const OrderIcon = filters.order === "desc" ? ArrowDownWideNarrow : ArrowUpNarrowWide;

  return (
    <div className="cnd-dos-timeline">
      <div className="cnd-dos-tl-toolbar">
        <div className="cnd-seg cnd-dos-tl-status" role="group" aria-label={tt("statusFilter")}>
          {TIMELINE_STATUS_FILTERS.map((key) => {
            const selected = filters.status === key;
            return (
              <button
                key={key}
                type="button"
                className={`cnd-seg__btn ${key === "overdue" && statusCounts.overdue > 0 ? "cnd-dos-seg--alert" : ""}`}
                aria-pressed={selected}
                onClick={() => setFilter({ status: key })}
              >
                {selected && <motion.span layoutId="cnd-dos-status-pill" className="cnd-seg__indicator" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                <span>{key === "all" ? tt("statusAll") : t(`adminCandidates.common.taskStatus.${key}`)}</span>
                <span className="cnd-dos-seg__count cnd-num">{statusCounts[key]}</span>
              </button>
            );
          })}
        </div>

        <div className="cnd-dos-tl-toolbar__row">
          <label className="cnd-dos-tl-select">
            <span className="cnd-sr-only">{tt("typeFilter")}</span>
            <select className="cnd-select" value={filters.type} onChange={(event) => setFilter({ type: event.target.value })}>
              <option value="all">{tt("typeAll")}</option>
              {TASK_TYPES.map(({ key }) => (
                <option key={key} value={key}>{t(`adminCandidates.common.taskType.${key}`)}</option>
              ))}
            </select>
          </label>
          <label className="cnd-dos-tl-select">
            <span className="cnd-sr-only">{tt("offerFilter")}</span>
            <select className="cnd-select" value={filters.applicationId} onChange={(event) => setFilter({ applicationId: event.target.value })}>
              <option value="all">{tt("offerAll")}</option>
              <option value="none">{tt("offerNone")}</option>
              {applications.map((app) => (
                <option key={app._id} value={String(app._id)}>
                  {app.offer?.title || t("adminCandidates.common.deletedOffer")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cnd-btn cnd-btn--secondary cnd-btn--sm"
            onClick={() => setFilter({ order: filters.order === "desc" ? "asc" : "desc" })}
            aria-label={tt(filters.order === "desc" ? "orderDescAria" : "orderAscAria")}
          >
            <OrderIcon size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span>{tt(filters.order === "desc" ? "orderDesc" : "orderAsc")}</span>
          </button>
          <button
            type="button"
            className="cnd-btn cnd-btn--secondary cnd-btn--sm"
            aria-pressed={filters.showSystem}
            onClick={() => setFilter({ showSystem: !filters.showSystem })}
          >
            <History size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
            <span>{filters.showSystem ? tt("hideSystem") : tt("showSystem")}</span>
          </button>
          {active && (
            <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--sm" onClick={() => onFiltersChange({ ...DEFAULT_TIMELINE_FILTERS, order: filters.order })}>
              <RotateCcw size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {tt("resetFilters")}
            </button>
          )}
        </div>
      </div>

      {nothingAtAll ? (
        <EmptyState
          icon={ClipboardList}
          title={tt("emptyTitle")}
          description={tt("emptyText")}
          action={(
            <button type="button" className="cnd-btn cnd-btn--primary" onClick={onAddTask}>
              <Plus size={ICON_SIZE} strokeWidth={2.2} aria-hidden="true" />
              {t("adminCandidates.dossier.addTask")}
            </button>
          )}
        />
      ) : (
        <>
          {!tasks.length && (
            <div className="cnd-dos-tl-hint">
              <ClipboardList size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
              <span>{tt("noTaskYet")}</span>
              <button type="button" className="cnd-btn cnd-btn--soft cnd-btn--sm cnd-tone--blue" onClick={onAddTask}>
                <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
                {t("adminCandidates.dossier.addTask")}
              </button>
            </div>
          )}
          {groups.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={tt("emptyFilteredTitle")}
              description={tt("emptyFilteredText")}
              action={(
                <button type="button" className="cnd-btn cnd-btn--secondary" onClick={() => onFiltersChange({ ...DEFAULT_TIMELINE_FILTERS, order: filters.order })}>
                  {tt("resetFilters")}
                </button>
              )}
            />
          ) : (
            <LayoutGroup>
              <div className="cnd-dos-tl-groups">
                <AnimatePresence initial={false}>
                  {groups.map((group) => (
                    <motion.section
                      key={group.key}
                      layout
                      className="cnd-dos-tl-group"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      aria-label={dayLabel(group.date)}
                    >
                      <h3 className="cnd-dos-tl-day"><span>{dayLabel(group.date)}</span></h3>
                      <ol className="cnd-dos-tl-list">
                        <AnimatePresence initial={false}>
                          {group.items.map((item) => (item.kind === "task" ? (
                            <TaskItem
                              key={item.id}
                              task={item.task}
                              now={now}
                              locale={locale}
                              highlighted={highlightId === item.task._id}
                              busy={busyTaskId === item.task._id}
                              canDelete={Boolean(currentUserId) && String(item.task.createdBy?._id || "") === String(currentUserId)}
                              onStatusChange={onStatusChange}
                              onEdit={onEdit}
                              onDelete={onDelete}
                              onFilterOffer={(applicationId) => setFilter({ applicationId })}
                            />
                          ) : (
                            <SystemItem key={item.id} event={item.event} locale={locale} />
                          )))}
                        </AnimatePresence>
                      </ol>
                    </motion.section>
                  ))}
                </AnimatePresence>
              </div>
            </LayoutGroup>
          )}
        </>
      )}
    </div>
  );
}
