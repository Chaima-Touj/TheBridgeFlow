import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiClock, FiUsers, FiMonitor, FiAlertCircle, FiCpu, FiLock, FiTrendingUp } from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { formationsService } from "../../services/formations.service.js";
import "./DashboardFormations.css";

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

function getIconEntry(slug = "") {
  return ICON_MAP[slug] ?? [{ Comp: SiReact, color: "#61DAFB" }];
}

function SkeletonCard() {
  return (
    <div className="df-card df-card--skel" aria-hidden="true">
      <div className="df-skel df-skel--icon" />
      <div className="df-skel df-skel--title" />
      <div className="df-skel df-skel--desc" />
      <div className="df-skel df-skel--desc df-skel--desc-sm" />
      <div className="df-skel df-skel--chips" />
      <div className="df-skel df-skel--btn" />
    </div>
  );
}

export default function DashboardFormations() {
  const { t } = useTranslation();
  const [formations, setFormations] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);

  useEffect(() => {
    let active = true;
    formationsService.getAll()
      .then(({ data }) => { if (active) setFormations(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const countText = formations.length === 1
    ? t("dashboardFormations.countOne")
    : t("dashboardFormations.countMany", { count: formations.length });

  return (
    <DashboardLayout
      title={t("dashboardFormations.title")}
      subtitle={t("dashboardFormations.subtitle")}
    >
      <div className="df-page">

        <div className="df-header">
          <h1 className="df-header__title">{t("dashboardFormations.heading")}</h1>
          <p className="df-header__sub">{loading ? "" : countText}</p>
        </div>

        {error && (
          <div className="df-error">
            <FiAlertCircle size={18} />
            <span>{t("dashboardFormations.error")}</span>
          </div>
        )}

        {loading ? (
          <div className="df-grid">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : formations.length === 0 ? (
          <div className="df-empty">
            <p className="df-empty__sub">{t("dashboardFormations.empty")}</p>
          </div>
        ) : (
          <div className="df-grid">
            {formations.map((f) => {
              const icons = getIconEntry(f.slug);
              return (
                <article key={f._id} className="df-card">

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {icons.map(({ Comp: Ic, color: c }, i) => (
                      <div
                        key={i}
                        className="df-card__icon"
                        style={{
                          background: `${c}18`,
                          color: c,
                          ...(icons.length >= 3 && { width: 40, height: 40 }),
                        }}
                      >
                        <Ic size={icons.length >= 3 ? 18 : 24} />
                      </div>
                    ))}
                  </div>

                  <h2 className="df-card__title">{f.title}</h2>

                  {f.description && (
                    <p className="df-card__desc">{f.description}</p>
                  )}

                  <div className="df-card__meta">
                    {f.duration && (
                      <span className="df-chip"><FiClock size={12}/>{f.duration}</span>
                    )}
                    {f.level && (
                      <span className="df-chip"><FiUsers size={12}/>{f.level}</span>
                    )}
                    {f.mode && (
                      <span className="df-chip"><FiMonitor size={12}/>{f.mode}</span>
                    )}
                  </div>

                  {(f.price?.onsite || f.price?.online) && (
                    <div className="df-card__prices">
                      {f.price.onsite && (
                        <span className="df-price">
                          <FiUsers size={11}/> {f.price.onsite}
                        </span>
                      )}
                      {f.price.online && (
                        <span className="df-price">
                          <FiMonitor size={11}/> {f.price.online}
                        </span>
                      )}
                    </div>
                  )}

                  <Link
                    to={`/dashboard/student/formations/${f.slug}`}
                    className="df-card__btn"
                  >
                    {t("dashboardFormations.viewDetails")}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
