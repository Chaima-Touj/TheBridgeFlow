import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Phone, MessageCircle, Mail, Plus, GraduationCap, CalendarDays, FileText, ClipboardList,
  AlarmClock, CircleCheck, CalendarClock,
} from "lucide-react";
import CandidateAvatar from "../shared/CandidateAvatar.jsx";
import { GlobalStatusBadge } from "../shared/StatusBadges.jsx";
import { ICON_SIZE, ICON_STROKE, toneClass } from "../candidatesConfig.js";
import { buildMailtoLink, buildTelLink, buildWhatsAppLink, formatDate } from "../candidatesUtils.js";

function ContactAction({ href, type, Icon, label, unavailable, onContact, external }) {
  if (!href) {
    return (
      <span className="cnd-btn cnd-btn--secondary cnd-dos-contact" aria-disabled="true" title={unavailable}>
        <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <a
      className="cnd-btn cnd-btn--secondary cnd-dos-contact"
      href={href}
      onClick={() => onContact(type)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}

export default function DossierHero({ student, globalStatus, summary, applicationsCount, locale, onAddTask, onContact }) {
  const { t } = useTranslation();
  const td = (key, options) => t(`adminCandidates.dossier.hero.${key}`, options);
  const openTasks = (summary?.pending || 0) + (summary?.in_progress || 0);
  const overdue = summary?.overdue || 0;

  const telLink = buildTelLink(student.phone);
  const whatsappLink = buildWhatsAppLink(student.phone);
  const mailLink = buildMailtoLink(student.email);

  const kpis = [
    { key: "applications", Icon: FileText, tone: "indigo", value: applicationsCount },
    { key: "openTasks", Icon: ClipboardList, tone: "blue", value: openTasks },
    { key: "overdue", Icon: AlarmClock, tone: overdue > 0 ? "red" : "slate", value: overdue, alert: overdue > 0 },
    { key: "completed", Icon: CircleCheck, tone: "emerald", value: summary?.completed || 0 },
    {
      key: "nextDue",
      Icon: CalendarClock,
      tone: "violet",
      value: summary?.nextDueAt ? formatDate(summary.nextDueAt, locale, { day: "2-digit", month: "short" }) : "—",
      small: true,
    },
  ];

  return (
    <motion.section
      className="cnd-dos-hero"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 0.8, 0.24, 1] }}
    >
      <div className="cnd-dos-hero__band" aria-hidden="true" />
      <div className="cnd-dos-hero__main">
        <CandidateAvatar name={student.name} avatarUrl={student.avatarUrl} size="xl" className="cnd-dos-hero__avatar" />
        <div className="cnd-dos-hero__identity">
          <div className="cnd-dos-hero__title">
            <h1>{student.name}</h1>
            <GlobalStatusBadge status={globalStatus} />
          </div>
          <div className="cnd-dos-hero__meta">
            {student.email && (
              <span><Mail size={14} strokeWidth={ICON_STROKE} aria-hidden="true" /><span className="cnd-ltr">{student.email}</span></span>
            )}
            {student.phone && (
              <span><Phone size={14} strokeWidth={ICON_STROKE} aria-hidden="true" /><span className="cnd-ltr">{student.phone}</span></span>
            )}
            {(student.university || student.specialty) && (
              <span><GraduationCap size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />{[student.university, student.specialty].filter(Boolean).join(" · ")}</span>
            )}
            {student.createdAt && (
              <span><CalendarDays size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />{td("memberSince", { date: formatDate(student.createdAt, locale) })}</span>
            )}
          </div>
        </div>
        <div className="cnd-dos-hero__actions">
          <div className="cnd-dos-hero__contacts" role="group" aria-label={td("contactGroup")}>
            <ContactAction href={telLink} type="call" Icon={Phone} label={td("call")} unavailable={td("noPhone")} onContact={onContact} />
            <ContactAction href={whatsappLink} type="whatsapp" Icon={MessageCircle} label={td("whatsapp")} unavailable={td("noPhone")} onContact={onContact} external />
            <ContactAction href={mailLink} type="email" Icon={Mail} label={td("email")} unavailable={td("noEmail")} onContact={onContact} />
          </div>
          <button type="button" className="cnd-btn cnd-btn--primary cnd-dos-hero__add" onClick={onAddTask}>
            <Plus size={ICON_SIZE} strokeWidth={2.2} aria-hidden="true" />
            {t("adminCandidates.dossier.addTask")}
          </button>
        </div>
      </div>

      <dl className="cnd-dos-kpis">
        {kpis.map(({ key, Icon, tone, value, alert, small }) => (
          <div key={key} className={`cnd-dos-kpi ${alert ? "cnd-dos-kpi--alert" : ""}`}>
            <span className={`cnd-icon-tile cnd-icon-tile--sm ${toneClass(tone)}`} aria-hidden="true">
              <Icon size={15} strokeWidth={ICON_STROKE} />
            </span>
            <span className="cnd-dos-kpi__text">
              <dt>{td(`kpi.${key}`)}</dt>
              <dd className={`cnd-num ${small ? "cnd-dos-kpi__value--small" : ""}`}>{value}</dd>
            </span>
          </div>
        ))}
      </dl>
    </motion.section>
  );
}
