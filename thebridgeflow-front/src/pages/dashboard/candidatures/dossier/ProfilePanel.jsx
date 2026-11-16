import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  UserRound, GraduationCap, BriefcaseBusiness, Award, Languages, Link2, Globe, ExternalLink, ShieldCheck,
  Mail, Phone, BookOpen,
} from "lucide-react";
import { ICON_STROKE } from "../candidatesConfig.js";
import { buildMailtoLink, buildTelLink, formatDate, formatDateTime, safeExternalUrl } from "../candidatesUtils.js";

function Section({ icon: Icon, title, children, index = 0, className = "" }) {
  return (
    <motion.section
      className={`cnd-card cnd-dos-profile-card ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.04 }}
    >
      <header className="cnd-dos-profile-card__head">
        <span className="cnd-icon-tile cnd-icon-tile--sm cnd-tone--blue" aria-hidden="true"><Icon size={15} strokeWidth={ICON_STROKE} /></span>
        <h3>{title}</h3>
      </header>
      <div className="cnd-dos-profile-card__body">{children}</div>
    </motion.section>
  );
}

function Facts({ items }) {
  const visible = items.filter((item) => item.value);
  if (!visible.length) return null;
  return (
    <dl className="cnd-dos-facts">
      {visible.map(({ label, value }) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

function period(start, end, current, locale, presentLabel) {
  if (!start && !end && !current) return "";
  const from = start ? formatDate(start, locale, { month: "short", year: "numeric" }) : "";
  const to = current ? presentLabel : end ? formatDate(end, locale, { month: "short", year: "numeric" }) : "";
  return [from, to].filter(Boolean).join(" – ");
}

export default function ProfilePanel({ student, locale }) {
  const { t } = useTranslation();
  const tp = (key, options) => t(`adminCandidates.dossier.profile.${key}`, options);
  const empty = <p className="cnd-dos-empty-line">{tp("notProvided")}</p>;
  const education = student.education || {};
  const hasEducation = Boolean(education.institution || education.degree || education.fieldOfStudy || education.grade || education.courses?.length);
  const links = [
    { key: "linkedin", Icon: Link2, href: safeExternalUrl(student.socialLinks?.linkedin) },
    { key: "github", Icon: Link2, href: safeExternalUrl(student.socialLinks?.github) },
    { key: "portfolio", Icon: Globe, href: safeExternalUrl(student.socialLinks?.portfolio) },
  ].filter((link) => link.href);
  const gender = student.gender === "homme" ? tp("genderMale") : student.gender === "femme" ? tp("genderFemale") : "";
  const mail = buildMailtoLink(student.email);
  const tel = buildTelLink(student.phone);

  return (
    <div className="cnd-dos-profile">
      <div className="cnd-dos-profile__col">
        <Section icon={UserRound} title={tp("identity")} index={0}>
          <Facts items={[
            { label: tp("fullName"), value: student.name },
            { label: tp("email"), value: student.email && (mail ? <a className="cnd-ltr" href={mail}><Mail size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{student.email}</a> : <span className="cnd-ltr">{student.email}</span>) },
            { label: tp("phone"), value: student.phone && (tel ? <a className="cnd-ltr" href={tel}><Phone size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />{student.phone}</a> : <span className="cnd-ltr">{student.phone}</span>) },
            { label: tp("gender"), value: gender },
          ]} />
        </Section>

        <Section icon={GraduationCap} title={tp("academic")} index={1}>
          {(student.university || student.specialty || hasEducation) ? (
            <>
              <Facts items={[
                { label: tp("university"), value: student.university },
                { label: tp("specialty"), value: student.specialty },
                { label: tp("institution"), value: education.institution },
                { label: tp("degree"), value: education.degree },
                { label: tp("fieldOfStudy"), value: education.fieldOfStudy },
                { label: tp("period"), value: period(education.startDate, education.endDate, education.current, locale, tp("present")) },
                { label: tp("grade"), value: education.grade },
              ]} />
              {education.courses?.length > 0 && (
                <div className="cnd-dos-tags cnd-dos-tags--spaced">
                  {education.courses.map((course) => <span key={course}>{course}</span>)}
                </div>
              )}
            </>
          ) : empty}
        </Section>

        <Section icon={BookOpen} title={tp("bio")} index={2}>
          {student.bio ? <p className="cnd-dos-bio">{student.bio}</p> : empty}
        </Section>

        <Section icon={BriefcaseBusiness} title={tp("experience")} index={3}>
          {student.experience?.length ? (
            <ul className="cnd-dos-xp">
              {student.experience.map((item, index) => (
                <li key={`${item.company}-${item.position}-${index}`}>
                  <strong>{item.position || item.company || "—"}</strong>
                  {(item.company || item.location) && <span>{[item.position ? item.company : "", item.location].filter(Boolean).join(" · ")}</span>}
                  {period(item.startDate, item.endDate, item.current, locale, tp("present")) && <small>{period(item.startDate, item.endDate, item.current, locale, tp("present"))}</small>}
                  {item.description && <p>{item.description}</p>}
                  {item.technologies?.length > 0 && (
                    <div className="cnd-dos-tags">{item.technologies.map((tech) => <span key={tech}>{tech}</span>)}</div>
                  )}
                </li>
              ))}
            </ul>
          ) : empty}
        </Section>
      </div>

      <div className="cnd-dos-profile__col">
        <Section icon={Award} title={tp("skills")} index={1}>
          {student.skills?.filter((skill) => skill.name).length ? (
            <div className="cnd-dos-tags">
              {student.skills.filter((skill) => skill.name).map((skill, index) => (
                <span key={`${skill.name}-${index}`}>
                  {skill.name}
                  {[skill.category, skill.level].filter(Boolean).length > 0 && <small>{[skill.category, skill.level].filter(Boolean).join(" · ")}</small>}
                </span>
              ))}
            </div>
          ) : empty}
        </Section>

        <Section icon={Languages} title={tp("languages")} index={2}>
          {student.languages?.filter((language) => language.name).length ? (
            <ul className="cnd-dos-lang">
              {student.languages.filter((language) => language.name).map((language, index) => (
                <li key={`${language.name}-${index}`}><strong>{language.name}</strong><span>{language.level}</span></li>
              ))}
            </ul>
          ) : empty}
        </Section>

        <Section icon={Link2} title={tp("links")} index={3}>
          {links.length ? (
            <div className="cnd-dos-links">
              {links.map(({ key, Icon, href }) => (
                <a key={key} href={href} target="_blank" rel="noopener noreferrer">
                  <Icon size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  <span>{tp(`link.${key}`)}</span>
                  <ExternalLink size={13} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : empty}
        </Section>

        <Section icon={ShieldCheck} title={tp("account")} index={4}>
          <Facts items={[
            { label: tp("joinedAt"), value: formatDate(student.createdAt, locale) },
            { label: tp("lastLoginAt"), value: formatDateTime(student.lastLoginAt, locale) },
            { label: tp("lastActiveAt"), value: formatDateTime(student.lastActiveAt, locale) },
            { label: tp("emailVerified"), value: student.isVerified ? tp("yes") : tp("no") },
            { label: tp("accountActive"), value: student.isActive === false ? tp("no") : tp("yes") },
          ]} />
        </Section>
      </div>
    </div>
  );
}
