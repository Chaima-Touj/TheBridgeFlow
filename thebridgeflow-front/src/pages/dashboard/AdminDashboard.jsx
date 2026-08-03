import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiUsers, FiBookOpen, FiClipboard, FiCheckSquare } from "react-icons/fi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { adminService } from "../../services/admin.service.js";
import "./StudentDashboard.css";

const COLORS = ["#2563EB", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#0EA5E9"];

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    let active = true;
    adminService.getDashboardStats()
      .then(({ data }) => { if (active) setStats(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const statCards = [
    { label: t("dashboard.admin.statTotalStudents"),      value: stats?.totalStudents,     color: "#2563EB", icon: <FiUsers size={20} /> },
    { label: t("dashboard.admin.statTotalFormations"),     value: stats?.totalFormations,   color: "#8B5CF6", icon: <FiBookOpen size={20} /> },
    { label: t("dashboard.admin.statPendingRequests"),  value: stats?.pendingRequests,   color: "#F59E0B", icon: <FiClipboard size={20} /> },
    { label: t("dashboard.admin.statActiveEnrollments"), value: stats?.activeEnrollments, color: "#10B981", icon: <FiCheckSquare size={20} /> },
  ];

  const enrollmentsByMonth = stats?.enrollmentsByMonth || [];
  const formationsByLevel  = stats?.formationsByLevel  || [];
  const totalByLevel = formationsByLevel.reduce((sum, d) => sum + d.count, 0);

  return (
    <DashboardLayout title={t("dashboard.admin.title")} subtitle={t("dashboard.admin.subtitle")}>
      <div className="sd-root">

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div className="sd-stats">
          {statCards.map((s, i) => (
            <div key={i} className="sd-stat-card">
              <div className="sd-stat-top">
                <div className="sd-stat-icon" style={{ background: s.color + "18", color: s.color }}>
                  {s.icon}
                </div>
                <div className="sd-stat-dot" style={{ background: s.color }} />
              </div>
              <div className="sd-stat-value">{loading ? "—" : (s.value ?? 0)}</div>
              <div className="sd-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Graphiques ───────────────────────────────────────────────── */}
        <div className="sd-split-grid">

          {/* Évolution des inscriptions */}
          <div className="sd-card">
            <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
              {t("dashboard.admin.enrollmentsChartTitle")}
            </h2>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 220 }} />
            ) : error ? (
              <div className="sd-empty-box">
                <p>{t("dashboard.admin.errorStats")}</p>
              </div>
            ) : enrollmentsByMonth.length === 0 ? (
              <div className="sd-empty-box">
                <FiCheckSquare size={28} style={{ opacity: .3 }} />
                <p>{t("dashboard.admin.noEnrollments")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={enrollmentsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name={t("sidebar.admin.inscriptions")} stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Formations par niveau */}
          <div className="sd-card">
            <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
              {t("dashboard.admin.formationsByLevelTitle")}
            </h2>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 220 }} />
            ) : error ? (
              <div className="sd-empty-box">
                <p>{t("dashboard.admin.errorStats")}</p>
              </div>
            ) : formationsByLevel.length === 0 ? (
              <div className="sd-empty-box">
                <FiBookOpen size={28} style={{ opacity: .3 }} />
                <p>{t("dashboard.admin.noFormationsRegistered")}</p>
              </div>
            ) : (
              <div className="sd-pie-row">
                <ResponsiveContainer width="48%" height={190}>
                  <PieChart>
                    <Pie
                      data={formationsByLevel}
                      dataKey="count"
                      nameKey="level"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {formationsByLevel.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="sd-pie-legend">
                  {formationsByLevel.map((d, i) => (
                    <div key={i} className="sd-pie-item">
                      <span className="sd-pie-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="sd-pie-name">{d.level}</span>
                      <strong>{d.count}</strong>
                      <span className="sd-pie-pct" style={{ color: COLORS[i % COLORS.length] }}>
                        ({totalByLevel > 0 ? Math.round((d.count / totalByLevel) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
