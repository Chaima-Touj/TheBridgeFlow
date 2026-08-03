import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiClipboard, FiArrowRight, FiClock, FiCheckCircle, FiXCircle,
  FiCalendar, FiMonitor, FiMapPin, FiCpu, FiLock, FiTrendingUp,
} from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { enrollmentRequestsService } from "../../services/enrollmentRequests.service.js";
import "./MesDemandes.css";

// ─── Icon map (keyed by slug for exact matching) ──────────────────────────────
const ICON_MAP = {
  "fullstack-spring-angular": [
    { Comp: SiSpringboot, color: "#6DB33F" },
    { Comp: SiAngular,    color: "#DD0031" },
  ],
  "mern-stack": [
    { Comp: SiReact,     color: "#61DAFB" },
    { Comp: SiNodedotjs, color: "#339933" },
  ],
  "mobile-flutter": [
    { Comp: SiFlutter,    color: "#54C5F8" },
    { Comp: SiNodedotjs,  color: "#339933" },
    { Comp: SiSpringboot, color: "#6DB33F" },
  ],
  "bi":                [{ Comp: FaChartBar,   color: "#F59E0B" }],
  "devops": [
    { Comp: SiDocker,     color: "#2496ED" },
    { Comp: SiKubernetes, color: "#326CE5" },
  ],
  "ai":                [{ Comp: FaRobot,       color: "#8B5CF6" }],
  "iot":               [{ Comp: FiCpu,         color: "#3B82F6" }],
  "cyber-security":    [{ Comp: FiLock,        color: "#10B981" }],
  "digital-marketing": [{ Comp: FiTrendingUp,  color: "#6366F1" }],
};

const STATUS_CONFIG = {
  en_attente: { labelKey: "mesDemandes.statusPending",  color: "#F59E0B", Icon: FiClock },
  acceptée:   { labelKey: "mesDemandes.statusAccepted", color: "#10B981", Icon: FiCheckCircle },
  refusée:    { labelKey: "mesDemandes.statusRejected", color: "#EF4444", Icon: FiXCircle },
};

function getIconEntry(slug = "") {
  return ICON_MAP[slug] ?? [{ Comp: SiReact, color: "#61DAFB" }];
}

function formatDate(dateStr, locale) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function MesDemandes() {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  const locale = i18n.language === "ar" ? "ar-TN" : i18n.language === "en" ? "en-US" : "fr-FR";

  useEffect(() => {
    enrollmentRequestsService.getAll()
      .then((res) => setRequests(res.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const countText = requests.length === 0
    ? t("mesDemandes.countZero")
    : requests.length === 1
    ? t("mesDemandes.countOne")
    : t("mesDemandes.countMany", { count: requests.length });

  return (
    <DashboardLayout
      title={t("mesDemandes.title")}
      subtitle={t("mesDemandes.subtitle")}
    >
      <div className="md-page">

        <div className="md-header">
          <h1 className="md-header__title">{t("mesDemandes.heading")}</h1>
          {!loading && !error && (
            <p className="md-header__sub">{countText}</p>
          )}
        </div>

        {loading && (
          <div className="md-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="md-card md-card--skel">
                <div className="md-skel md-skel--icon" />
                <div className="md-card__body">
                  <div className="md-skel md-skel--title" />
                  <div className="md-skel md-skel--sub" />
                </div>
                <div className="md-skel md-skel--badge" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="md-error">
            <FiXCircle size={16} /> {t("mesDemandes.error")}
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div className="md-empty">
            <div className="md-empty__icon">
              <FiClipboard size={40} />
            </div>
            <h2 className="md-empty__title">{t("mesDemandes.emptyTitle")}</h2>
            <p className="md-empty__sub">{t("mesDemandes.emptySub")}</p>
            <Link to="/dashboard/student/formations" className="md-empty__btn">
              {t("mesDemandes.browseCta")} <FiArrowRight size={14} />
            </Link>
          </div>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="md-list">
            {requests.map((req) => {
              const formation = req.formation || {};
              const icons = getIconEntry(formation.slug || "");
              const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.en_attente;
              const StatusIcon = status.Icon;

              return (
                <div key={req._id} className="md-card">
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {icons.map(({ Comp: Ic, color: c }, i) => (
                      <div
                        key={i}
                        className="md-card__icon"
                        style={{
                          background: `${c}18`,
                          color: c,
                          ...(icons.length >= 3 && { width: 34, height: 34 }),
                        }}
                      >
                        <Ic size={icons.length >= 3 ? 15 : 20} />
                      </div>
                    ))}
                  </div>

                  <div className="md-card__body">
                    <h3 className="md-card__title">{formation.title}</h3>
                    <div className="md-card__meta">
                      <span className="md-chip">
                        {req.mode === "Présentiel" ? <FiMapPin size={11} /> : <FiMonitor size={11} />}
                        {req.mode}
                      </span>
                      <span className="md-chip">
                        <FiCalendar size={11} />
                        {formatDate(req.createdAt, locale)}
                      </span>
                      {formation.duration && (
                        <span className="md-chip">⏱ {formation.duration}</span>
                      )}
                    </div>
                  </div>

                  <div className="md-card__right">
                    <span
                      className="md-badge"
                      style={{
                        background: `${status.color}15`,
                        color: status.color,
                        borderColor: `${status.color}35`,
                      }}
                    >
                      <StatusIcon size={12} />
                      {t(status.labelKey)}
                    </span>
                    {formation.slug && (
                      <Link
                        to={`/dashboard/student/formations/${formation.slug}`}
                        className="md-card__link"
                      >
                        {t("mesDemandes.viewFormation")} <FiArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
