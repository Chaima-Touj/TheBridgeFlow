import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Users, FileText, PhoneCall, CalendarClock, ClipboardList, AlarmClock, RotateCw, TriangleAlert } from "lucide-react";
import { candidatesService } from "../../../services/candidates.service.js";
import { ICON_STROKE, toneClass } from "./candidatesConfig.js";
import { isCanceledError, isNetworkError, resolveLocale } from "./candidatesUtils.js";
import Skeleton from "./shared/Skeleton.jsx";

// Indicateurs calculés côté backend (GET /api/admin/candidates/stats).
const CARDS = [
  { key: "totalStudents",       Icon: Users,         tone: "blue" },
  { key: "totalApplications",   Icon: FileText,      tone: "indigo" },
  { key: "studentsToContact",   Icon: PhoneCall,     tone: "amber",  filter: "new" },
  { key: "scheduledInterviews", Icon: CalendarClock, tone: "violet", filter: "interview" },
  { key: "pendingTasks",        Icon: ClipboardList, tone: "cyan" },
  { key: "overdueTasks",        Icon: AlarmClock,    tone: "red",    filter: "overdue", alert: true },
];

function AnimatedNumber({ value, locale }) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const display = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString(locale));

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return undefined;
    }
    const controls = animate(motionValue, value, { duration: 0.7, ease: [0.22, 0.8, 0.24, 1] });
    return () => controls.stop();
  }, [value, reduceMotion, motionValue]);

  return <motion.span>{display}</motion.span>;
}

export default function CandidatureStats({ refreshKey = 0, onStats, onSelectFilter, activeFilter }) {
  const { t, i18n } = useTranslation();
  const tl = (key, options) => t(`adminCandidates.list.stats.${key}`, options);
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const [retry, setRetry] = useState(0);
  const requestKey = `${refreshKey}:${retry}`;
  const [result, setResult] = useState({ key: null, stats: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    candidatesService.getStats({ signal: controller.signal })
      .then(({ data }) => {
        setResult({ key: requestKey, stats: data.stats, error: "" });
        onStats?.(data.stats);
      })
      .catch((error) => {
        if (isCanceledError(error)) return;
        const message = isNetworkError(error)
          ? t("adminCandidates.common.errors.network")
          : error?.response?.status === 429
            ? t("adminCandidates.common.errors.rateLimited")
            : tl("loadError");
        setResult((previous) => ({ key: requestKey, stats: previous.stats, error: message }));
      });
    return () => controller.abort();
    // `t`, `tl` et `onStats` sont stables pour une même langue ; seul requestKey déclenche un rechargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = result.key !== requestKey && !result.stats;
  const stats = result.stats;

  if (!stats && result.error && !loading) {
    return (
      <div className="cnd-alert cnd-tone--red cnd-list-stats-error" role="alert">
        <TriangleAlert size={16} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span className="cnd-alert__body">{result.error}</span>
        <button type="button" className="cnd-btn cnd-btn--secondary cnd-btn--sm" onClick={() => setRetry((value) => value + 1)}>
          <RotateCw size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
          {t("adminCandidates.common.actions.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="cnd-list-stats-wrap">
    <section className="cnd-list-stats" aria-label={tl("label")} aria-busy={loading}>
      {CARDS.map(({ key, Icon, tone, filter, alert }, index) => {
        const value = stats?.[key] ?? 0;
        const isAlert = alert && value > 0;
        const clickable = Boolean(filter && onSelectFilter && stats);
        const content = (
          <>
            <span className={`cnd-icon-tile cnd-list-stat__icon ${toneClass(isAlert || !alert ? tone : "slate")}`} aria-hidden="true">
              <Icon size={18} strokeWidth={ICON_STROKE} />
            </span>
            <span className="cnd-list-stat__body">
              <span className="cnd-list-stat__value cnd-num">
                {stats ? <AnimatedNumber value={value} locale={locale} /> : <Skeleton width={44} height={24} />}
              </span>
              <span className="cnd-list-stat__label">{tl(`${key}.label`)}</span>
              <span className="cnd-list-stat__hint">{tl(`${key}.hint`)}</span>
            </span>
          </>
        );
        const className = `cnd-list-stat ${isAlert ? "cnd-list-stat--alert" : ""} ${clickable ? "cnd-list-stat--clickable" : ""} ${activeFilter && activeFilter === filter ? "cnd-list-stat--active" : ""}`;
        return (
          <motion.div
            key={key}
            className="cnd-list-stat-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            {clickable ? (
              <button
                type="button"
                className={className}
                onClick={() => onSelectFilter(filter)}
                aria-pressed={activeFilter === filter}
                title={tl("filterHint")}
              >
                {content}
              </button>
            ) : (
              <div className={className}>{content}</div>
            )}
          </motion.div>
        );
      })}
    </section>
    </div>
  );
}
