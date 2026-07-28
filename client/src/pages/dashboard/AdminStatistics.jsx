import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FiTrendingUp, FiBookOpen, FiPercent, FiClipboard, FiDownload } from "react-icons/fi";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import jsPDF from "jspdf";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { adminService } from "../../services/admin.service.js";
import { writePdfHeader, writePdfTable, pdfSafe } from "../../utils/exportTable.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";

const COLORS = ["#2563EB", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#0EA5E9"];
const STATUS_COLORS = { en_attente: "#F59E0B", "acceptée": "#10B981", "refusée": "#EF4444" };

const STATUS_LABEL = { en_attente: "En attente", "acceptée": "Acceptée", "refusée": "Refusée" };

function exportStatisticsPDF({ stats, pipelineByMonth, enrollmentsByFormation, statusData, totalStatus, t }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateStr = new Date().toLocaleDateString("fr-FR");

  writePdfHeader(doc, t("adminStats.pdfTitle"), t("adminFormations.pdfExportedOn", { date: dateStr }));

  let y = writePdfTable(doc, {
    startY: 27,
    head: [t("adminStats.pdfColIndicator"), t("adminStats.pdfColValue")],
    body: [
      [t("adminStats.statConversionRate"), `${stats?.conversionRate ?? 0}%`],
      [t("adminStats.statTotalRequests"), String(stats?.totalRequests ?? 0)],
      [t("adminStats.statTopFormation"), enrollmentsByFormation[0]?.title || "—"],
    ],
  });

  if (pipelineByMonth.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(t("adminStats.pipelineChartTitle")), 14, y + 10);
    y = writePdfTable(doc, {
      startY: y + 14,
      head: [t("adminStats.pdfColMonth"), t("adminStats.legendRequests"), t("adminStats.legendEnrollments")],
      body: pipelineByMonth.map((p) => [p.month, String(p.requests), String(p.enrollments)]),
    });
  }

  if (totalStatus > 0) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(t("adminStats.statusChartTitle")), 14, y + 10);
    y = writePdfTable(doc, {
      startY: y + 14,
      head: [t("adminStats.pdfColStatus"), t("adminStats.pdfColCount"), t("adminStats.pdfColPercent")],
      body: statusData.map((d) => [
        STATUS_LABEL[d.status] || d.status,
        String(d.count),
        `${totalStatus > 0 ? Math.round((d.count / totalStatus) * 100) : 0}%`,
      ]),
    });
  }

  if (enrollmentsByFormation.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(t("adminStats.byFormationChartTitle")), 14, y + 10);
    writePdfTable(doc, {
      startY: y + 14,
      head: [t("adminStats.pdfColFormation"), t("sidebar.admin.inscriptions")],
      body: enrollmentsByFormation.map((f) => [f.title, String(f.count)]),
    });
  }

  doc.save(`statistiques-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function AdminStatistics() {
  const { t } = useTranslation();
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [topOffers,     setTopOffers]     = useState([]);
  const [topFormations, setTopFormations] = useState([]);
  const [topPages,        setTopPages]        = useState([]);
  const [visitsByDay,     setVisitsByDay]     = useState([]);

  useEffect(() => {
    let active = true;
    adminService.getAdvancedStats()
      .then(({ data }) => { if (active) setStats(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Polling du nombre d'utilisateurs connectés toutes les 30s
  useEffect(() => {
    const fetchOnline = () => {
      adminService.getOnlineCount()
        .then(({ data }) => setOnlineCount(data.online))
        .catch(() => {});
    };
    fetchOnline();
    const id = setInterval(fetchOnline, 30000);
    return () => clearInterval(id);
  }, []);

  // Chargement des offres les plus consultées
  useEffect(() => {
    adminService.getTopOffers()
      .then(({ data }) => setTopOffers(data.offers))
      .catch(() => {});
  }, []);

  // Chargement des formations les plus consultées
  useEffect(() => {
    adminService.getTopFormations()
      .then(({ data }) => setTopFormations(data.formations))
      .catch(() => {});
  }, []);

  // Chargement des pages les plus visitées
  useEffect(() => {
    adminService.getTopPages()
      .then(({ data }) => setTopPages(data.pages))
      .catch(() => {});
  }, []);

  // Chargement des visites par jour (30 derniers jours)
  useEffect(() => {
    adminService.getVisitsByDay()
      .then(({ data }) => setVisitsByDay(data.visits))
      .catch(() => {});
  }, []);

  const pipelineByMonth      = stats?.pipelineByMonth || [];
  const enrollmentsByFormation = stats?.enrollmentsByFormation || [];
  const requestsByStatus     = stats?.requestsByStatus || { en_attente: 0, "acceptée": 0, "refusée": 0 };
  const statusData = Object.entries(requestsByStatus).map(([status, count]) => ({ status, count }));
  const totalStatus = statusData.reduce((sum, d) => sum + d.count, 0);

  const statCards = [
    { label: t("adminStats.statConversionRate"), value: loading ? "—" : `${stats?.conversionRate ?? 0}%`, color: "#10B981", icon: <FiPercent size={20} /> },
    { label: t("adminStats.statTotalRequests"),   value: loading ? "—" : (stats?.totalRequests ?? 0),     color: "#F59E0B", icon: <FiClipboard size={20} /> },
    { label: t("adminStats.statTopFormation"),    value: loading ? "—" : (enrollmentsByFormation[0]?.title || "—"), color: "#2563EB", icon: <FiBookOpen size={20} /> },
  ];

  const handleExportPDF = () => exportStatisticsPDF({ stats, pipelineByMonth, enrollmentsByFormation, statusData, totalStatus, t });

  return (
    <DashboardLayout title={t("sidebar.admin.stats")} subtitle={t("adminStats.pageSubtitle")}>
      <div className="sd-root">

        {/* ── Export ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-0.5rem" }}>
          <button type="button" className="af-toolbar-btn" onClick={handleExportPDF} disabled={loading || error}>
            <FiDownload size={14} /> {t("adminFormations.exportPdf")}
          </button>
        </div>

        {/* ── Indicateurs clés ─────────────────────────────────────────── */}
        <div className="sd-stats">
          {/* Carte "Étudiants connectés maintenant" avec point vert animé */}
          <div className="sd-stat-card">
            <div className="sd-stat-top">
              <div className="sd-stat-icon" style={{ background: "#10B98118", color: "#10B981" }}>
                <FiTrendingUp size={20} />
              </div>
              <div className="sd-online-dot" />
            </div>
            <div className="sd-stat-value">{onlineCount}</div>
            <div className="sd-stat-label">{t("adminStats.onlineNow")}</div>
          </div>
          {statCards.map((s, i) => (
            <div key={i} className="sd-stat-card">
              <div className="sd-stat-top">
                <div className="sd-stat-icon" style={{ background: s.color + "18", color: s.color }}>
                  {s.icon}
                </div>
                <div className="sd-stat-dot" style={{ background: s.color }} />
              </div>
              <div className="sd-stat-value" style={{ fontSize: typeof s.value === "string" && s.value.length > 12 ? "1rem" : undefined }}>
                {s.value}
              </div>
              <div className="sd-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Offres les plus consultées ──────────────────────────────── */}
        <div className="sd-card">
          <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
            {t("adminStats.topOffersTitle")}
          </h2>
          {topOffers.length === 0 ? (
            <div className="sd-empty-box">
              <FiTrendingUp size={28} style={{ opacity: .3 }} />
              <p>{t("adminStats.topOffersEmpty")}</p>
            </div>
          ) : (
            <div className="sd-req-list">
              {topOffers.map((offer, i) => (
                <div key={i} className="sd-req-item">
                  <div className="sd-req-icon" style={{ background: "#F59E0B18", color: "#F59E0B" }}>
                    <FiTrendingUp size={16} />
                  </div>
                  <div className="sd-req-info">
                    <div className="sd-req-title">{offer.title}</div>
                    <div className="sd-req-meta">{t("adminStats.topOffersViews", { count: offer.views })}</div>
                  </div>
                  <span className="sd-req-badge" style={{ background: "#F59E0B18", color: "#F59E0B" }}>
                    {offer.views} {t("adminStats.views")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Formations les plus consultées ──────────────────────────── */}
        <div className="sd-card">
          <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
            {t("adminStats.topFormationsTitle")}
          </h2>
          {topFormations.length === 0 ? (
            <div className="sd-empty-box">
              <FiBookOpen size={28} style={{ opacity: .3 }} />
              <p>{t("adminStats.topFormationsEmpty")}</p>
            </div>
          ) : (
            <div className="sd-req-list">
              {topFormations.map((formation, i) => (
                <div key={i} className="sd-req-item">
                  <div className="sd-req-icon" style={{ background: "#2563EB18", color: "#2563EB" }}>
                    <FiBookOpen size={16} />
                  </div>
                  <div className="sd-req-info">
                    <div className="sd-req-title">{formation.title}</div>
                    <div className="sd-req-meta">{t("adminStats.topFormationsViews", { count: formation.views })}</div>
                  </div>
                  <span className="sd-req-badge" style={{ background: "#2563EB18", color: "#2563EB" }}>
                    {formation.views} {t("adminStats.views")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pages les plus visitées ──────────────────────────────────── */}
        <div className="sd-card">
          <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
            {t("adminStats.topPagesTitle")}
          </h2>
          {topPages.length === 0 ? (
            <div className="sd-empty-box">
              <FiTrendingUp size={28} style={{ opacity: .3 }} />
              <p>{t("adminStats.topPagesEmpty")}</p>
            </div>
          ) : (
            <div className="sd-req-list">
              {(() => {
                const maxCount = Math.max(...topPages.map((p) => p.count));
                return topPages.map((page, i) => (
                  <div key={i} className="sd-req-item" style={{ position: "relative", overflow: "hidden" }}>
                    {/* Barre de progression proportionnelle au nb de vues */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: `${(page.count / maxCount) * 100}%`,
                        background: "linear-gradient(90deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.04) 100%)",
                        borderRadius: "inherit",
                        transition: "width 0.4s ease",
                        pointerEvents: "none",
                      }}
                    />
                    <div className="sd-req-icon" style={{ background: "#2563EB18", color: "#2563EB", position: "relative", zIndex: 1 }}>
                      <FiTrendingUp size={16} />
                    </div>
                    <div className="sd-req-info" style={{ position: "relative", zIndex: 1 }}>
                      <div className="sd-req-title" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{page.path}</div>
                      <div className="sd-req-meta">{page.count} {t("adminStats.views")}</div>
                    </div>
                    <span className="sd-req-badge" style={{ background: "#2563EB18", color: "#2563EB", position: "relative", zIndex: 1 }}>
                      {page.count}
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* ── Graphiques ───────────────────────────────────────────────── */}
        <div className="sd-split-grid">

          {/* Demandes vs Inscriptions dans le temps */}
          <div className="sd-card">
            <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
              {t("adminStats.pipelineChartTitle")}
            </h2>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 220 }} />
            ) : error ? (
              <div className="sd-empty-box"><p>{t("adminStats.errorStats")}</p></div>
            ) : pipelineByMonth.length === 0 ? (
              <div className="sd-empty-box">
                <FiTrendingUp size={28} style={{ opacity: .3 }} />
                <p>{t("adminStats.noData")}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={pipelineByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="requests"    name={t("adminStats.legendRequests")}    stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="enrollments" name={t("adminStats.legendEnrollments")} stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Statut des demandes */}
          <div className="sd-card">
            <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
              {t("adminStats.statusChartTitle")}
            </h2>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 220 }} />
            ) : error ? (
              <div className="sd-empty-box"><p>{t("adminStats.errorStats")}</p></div>
            ) : totalStatus === 0 ? (
              <div className="sd-empty-box">
                <FiClipboard size={28} style={{ opacity: .3 }} />
                <p>{t("adminStats.noData")}</p>
              </div>
            ) : (
              <div className="sd-pie-row">
                <ResponsiveContainer width="48%" height={190}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {statusData.map((d, i) => (
                        <Cell key={i} fill={STATUS_COLORS[d.status] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="sd-pie-legend">
                  {statusData.map((d, i) => (
                    <div key={i} className="sd-pie-item">
                      <span className="sd-pie-dot" style={{ background: STATUS_COLORS[d.status] || COLORS[i % COLORS.length] }} />
                      <span className="sd-pie-name">{t(`mesDemandes.status${d.status === "en_attente" ? "Pending" : d.status === "acceptée" ? "Accepted" : "Rejected"}`)}</span>
                      <strong>{d.count}</strong>
                      <span className="sd-pie-pct" style={{ color: STATUS_COLORS[d.status] || COLORS[i % COLORS.length] }}>
                        ({totalStatus > 0 ? Math.round((d.count / totalStatus) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Répartition des inscriptions par formation ──────────────────── */}
        <div className="sd-card" style={{ marginTop: "1.5rem" }}>
          <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
            {t("adminStats.byFormationChartTitle")}
          </h2>
          {loading ? (
            <div className="sd-skeleton" style={{ height: 260 }} />
          ) : error ? (
            <div className="sd-empty-box"><p>{t("adminStats.errorStats")}</p></div>
          ) : enrollmentsByFormation.length === 0 ? (
            <div className="sd-empty-box">
              <FiBookOpen size={28} style={{ opacity: .3 }} />
              <p>{t("adminStats.noData")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, enrollmentsByFormation.length * 42)}>
              <BarChart data={enrollmentsByFormation} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="title" tick={{ fontSize: 12 }} width={220} />
                <Tooltip />
                <Bar dataKey="count" name={t("sidebar.admin.inscriptions")} fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Évolution des visites par jour ───────────────────────────────── */}
        <div className="sd-card" style={{ marginTop: "1.5rem" }}>
          <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
            {t("adminStats.visitsByDayTitle")}
          </h2>
          {visitsByDay.length === 0 ? (
            <div className="sd-empty-box">
              <FiTrendingUp size={28} style={{ opacity: .3 }} />
              <p>{t("adminStats.noData")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={visitsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="count" name={t("adminStats.views")} stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
