import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiClipboard, FiAlertTriangle, FiCheck, FiX,
  FiChevronLeft, FiChevronRight, FiMapPin, FiMonitor,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import ExportMenu from "../../components/common/ExportMenu.jsx";
import { downloadCSV, exportSingleTablePDF } from "../../utils/exportTable.js";
import { enrollmentRequestsService } from "../../services/enrollmentRequests.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminUsers.css";

const STATUS_BADGE = {
  en_attente: "badge-warning",
  "acceptée": "badge-success",
  "refusée":  "badge-danger",
};

const STATUS_LABEL_KEY = {
  en_attente: "mesDemandes.statusPending",
  "acceptée": "mesDemandes.statusAccepted",
  "refusée":  "mesDemandes.statusRejected",
};

const PAGE_SIZES = [6, 10, 25, 50];

const AVATAR_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function getPageNumbers(current, total) {
  const delta = 1;
  const range = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) range.push(i);
  if (range[0] > 1) {
    if (range[0] > 2) range.unshift("…");
    range.unshift(1);
  }
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) range.push("…");
    range.push(total);
  }
  return range;
}

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function exportRequestsCSV(rows, t) {
  const headers = [
    t("adminDemandes.csvColStudent"), t("adminDemandes.csvColEmail"), t("adminDemandes.colFormation"),
    t("adminDemandes.colMode"), t("adminDemandes.colDate"), t("adminDemandes.colStatus"),
  ];
  const body = rows.map((r) => [
    r.student?.name, r.student?.email, r.formation?.title,
    r.mode, formatDate(r.createdAt), t(STATUS_LABEL_KEY[r.status] || r.status),
  ]);
  downloadCSV(`demandes-inscription-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
}

function exportRequestsPDF(rows, t) {
  const head = [
    t("adminDemandes.csvColStudent"), t("adminDemandes.colFormation"),
    t("adminDemandes.colMode"), t("adminDemandes.colDate"), t("adminDemandes.colStatus"),
  ];
  const body = rows.map((r) => [
    r.student?.name || "—", r.formation?.title || "—",
    r.mode || "—", formatDate(r.createdAt), t(STATUS_LABEL_KEY[r.status] || r.status),
  ]);
  exportSingleTablePDF({
    filename: `demandes-inscription-${new Date().toISOString().slice(0, 10)}.pdf`,
    title: t("adminDemandes.pdfTitle"),
    dateLabel: t("adminFormations.pdfExportedOn", { date: new Date().toLocaleDateString("fr-FR") }),
    head,
    body,
  });
}

export default function AdminEnrollmentRequests() {
  const { t } = useTranslation();

  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("en_attente");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [actionId, setActionId] = useState(null);
  const [rowActionError, setRowActionError] = useState("");

  const loadRequests = useCallback(() => {
    enrollmentRequestsService.getAllAdmin(statusFilter)
      .then(({ data }) => { setRequests(data || []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      (r.student?.name || "").toLowerCase().includes(q) ||
      (r.formation?.title || "").toLowerCase().includes(q)
    );
  }, [requests, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDecision = async (req, decision) => {
    setRowActionError("");
    setActionId(req._id);
    try {
      if (decision === "accept") await enrollmentRequestsService.accept(req._id);
      else                        await enrollmentRequestsService.reject(req._id);
      loadRequests();
    } catch (err) {
      setRowActionError(extractErrorMessage(err, t("adminDemandes.errors.decisionFailed")));
    } finally {
      setActionId(null);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.demandes")} subtitle={t("adminDemandes.pageSubtitle")}>
      <div className="sd-root">
        <div className="af-card">

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar au-toolbar">
            <h1 className="af-toolbar-title">{t("sidebar.admin.demandes")}</h1>
            <div className="af-toolbar-actions">
              <input
                type="search"
                className="input au-search"
                placeholder={t("adminDemandes.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />

              <select
                className="af-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label={t("adminDemandes.filterStatusAll")}
              >
                <option value="all">{t("adminDemandes.filterStatusAll")}</option>
                <option value="en_attente">{t("mesDemandes.statusPending")}</option>
                <option value="acceptée">{t("mesDemandes.statusAccepted")}</option>
                <option value="refusée">{t("mesDemandes.statusRejected")}</option>
              </select>

              <div className="af-select-wrap">
                <label htmlFor="ad-page-size">{t("adminFormations.display")}</label>
                <select
                  id="ad-page-size"
                  className="af-select"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <ExportMenu
                onExportPDF={() => exportRequestsPDF(filtered, t)}
                onExportCSV={() => exportRequestsCSV(filtered, t)}
              />
            </div>
          </div>

          {rowActionError && (
            <div className="af-form-error" style={{ margin: "0 20px 16px" }}>
              <FiAlertTriangle size={15} />
              <span>{rowActionError}</span>
            </div>
          )}

          {/* ── Tableau ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
          ) : error ? (
            <div className="sd-empty-box">
              <p>{t("adminDemandes.errors.generic")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sd-empty-box">
              <FiClipboard size={28} style={{ opacity: .3 }} />
              <p>{t("adminDemandes.emptyState")}</p>
            </div>
          ) : (
            <>
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>{t("adminDemandes.colStudent")}</th>
                      <th>{t("adminDemandes.colFormation")}</th>
                      <th>{t("adminDemandes.colMode")}</th>
                      <th>{t("adminDemandes.colDate")}</th>
                      <th>{t("adminDemandes.colStatus")}</th>
                      <th>{t("adminDemandes.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((req) => {
                      const isPending = req.status === "en_attente";
                      const isUpdating = actionId === req._id;
                      return (
                        <tr key={req._id}>
                          <td className="af-cell-title">
                            <div className="af-formation-cell">
                              <div className="af-avatar af-avatar--placeholder" style={{ background: avatarColor(req.student?.name) }}>
                                {req.student?.name?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div className="au-user-cell">
                                <span className="af-formation-title-text">{req.student?.name || "—"}</span>
                                <span className="au-user-email">{req.student?.email || ""}</span>
                              </div>
                            </div>
                          </td>
                          <td>{req.formation?.title || "—"}</td>
                          <td>
                            <span className="md-chip" style={{ display: "inline-flex" }}>
                              {req.mode === "Présentiel" ? <FiMapPin size={11} /> : <FiMonitor size={11} />}
                              {req.mode}
                            </span>
                          </td>
                          <td>{formatDate(req.createdAt)}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[req.status] || "badge-warning"}`}>
                              {t(STATUS_LABEL_KEY[req.status] || "mesDemandes.statusPending")}
                            </span>
                          </td>
                          <td>
                            {isPending ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="af-icon-btn"
                                  style={{ color: "#10B981" }}
                                  disabled={isUpdating}
                                  title={t("adminDemandes.acceptAction")}
                                  aria-label={t("adminDemandes.acceptAction")}
                                  onClick={() => handleDecision(req, "accept")}
                                >
                                  <FiCheck size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="af-icon-btn"
                                  style={{ color: "#EF4444" }}
                                  disabled={isUpdating}
                                  title={t("adminDemandes.rejectAction")}
                                  aria-label={t("adminDemandes.rejectAction")}
                                  onClick={() => handleDecision(req, "reject")}
                                >
                                  <FiX size={16} />
                                </button>
                              </div>
                            ) : (
                              <span className="au-user-email">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ─────────────────────────────────────────── */}
              <div className="af-pagination">
                <button
                  type="button"
                  className="af-page-nav"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <FiChevronLeft size={14} /> {t("offers.previous")}
                </button>

                <div className="af-page-numbers">
                  {getPageNumbers(currentPage, totalPages).map((n, i) =>
                    n === "…"
                      ? <span key={`e${i}`} className="af-page-ellipsis">…</span>
                      : (
                        <button
                          key={n}
                          type="button"
                          className={`af-page-btn ${n === currentPage ? "af-page-btn--active" : ""}`}
                          onClick={() => setPage(n)}
                        >
                          {String(n).padStart(2, "0")}
                        </button>
                      )
                  )}
                </div>

                <button
                  type="button"
                  className="af-page-nav"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("offers.next")} <FiChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
