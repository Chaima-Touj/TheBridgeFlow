import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiCheckSquare, FiAlertTriangle, FiEye, FiTrash2,
  FiChevronLeft, FiChevronRight, FiCheckCircle,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import ExportMenu from "../../components/common/ExportMenu.jsx";
import { downloadCSV, exportSingleTablePDF } from "../../utils/exportTable.js";
import { enrollmentsService } from "../../services/enrollments.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminUsers.css";

const STATUS_BADGE = {
  not_started: "badge-warning",
  in_progress: "badge-primary",
  completed:   "badge-success",
};

const STATUS_LABEL_KEY = {
  not_started: "adminInscriptions.statusNotStarted",
  in_progress: "adminInscriptions.statusInProgress",
  completed:   "adminInscriptions.statusCompleted",
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

function progressText(weekProgress = []) {
  const total = weekProgress.length;
  const done  = weekProgress.filter((w) => w.status === "done").length;
  return `${done}/${total}`;
}

function exportEnrollmentsCSV(rows, t) {
  const headers = [
    t("adminInscriptions.csvColStudent"), t("adminInscriptions.csvColEmail"), t("adminInscriptions.colFormation"),
    t("adminInscriptions.colStatus"), t("adminInscriptions.colProgress"), t("adminInscriptions.colDate"),
  ];
  const body = rows.map((e) => [
    e.student?.name, e.student?.email, e.formation?.title,
    t(STATUS_LABEL_KEY[e.overallStatus] || e.overallStatus), progressText(e.weekProgress), formatDate(e.createdAt),
  ]);
  downloadCSV(`inscriptions-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
}

function exportEnrollmentsPDF(rows, t) {
  const head = [
    t("adminInscriptions.csvColStudent"), t("adminInscriptions.colFormation"),
    t("adminInscriptions.colStatus"), t("adminInscriptions.colProgress"), t("adminInscriptions.colDate"),
  ];
  const body = rows.map((e) => [
    e.student?.name || "—", e.formation?.title || "—",
    t(STATUS_LABEL_KEY[e.overallStatus] || e.overallStatus), progressText(e.weekProgress), formatDate(e.createdAt),
  ]);
  exportSingleTablePDF({
    filename: `inscriptions-${new Date().toISOString().slice(0, 10)}.pdf`,
    title: t("adminInscriptions.pdfTitle"),
    dateLabel: t("adminFormations.pdfExportedOn", { date: new Date().toLocaleDateString("fr-FR") }),
    head,
    body,
  });
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

export default function AdminEnrollments() {
  const { t } = useTranslation();

  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [detailTarget, setDetailTarget] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelError,  setCancelError]  = useState("");

  const loadEnrollments = useCallback(() => {
    enrollmentsService.getAllAdmin(statusFilter)
      .then(({ data }) => { setEnrollments(data || []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) =>
      (e.student?.name || "").toLowerCase().includes(q) ||
      (e.formation?.title || "").toLowerCase().includes(q)
    );
  }, [enrollments, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCancel  = (e) => { setCancelError(""); setCancelTarget(e); };
  const closeCancel = () => { if (!cancelling) { setCancelTarget(null); setCancelError(""); } };

  const confirmCancel = async () => {
    setCancelling(true);
    setCancelError("");
    try {
      await enrollmentsService.cancel(cancelTarget._id);
      setEnrollments((prev) => prev.filter((e) => e._id !== cancelTarget._id));
      setCancelTarget(null);
    } catch (err) {
      setCancelError(extractErrorMessage(err, t("adminInscriptions.errors.cancelFailed")));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.inscriptions")} subtitle={t("adminInscriptions.pageSubtitle")}>
      <div className="sd-root">
        <div className="af-card">

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar au-toolbar">
            <h1 className="af-toolbar-title">{t("sidebar.admin.inscriptions")}</h1>
            <div className="af-toolbar-actions">
              <input
                type="search"
                className="input au-search"
                placeholder={t("adminInscriptions.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />

              <select
                className="af-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label={t("adminInscriptions.filterStatusAll")}
              >
                <option value="all">{t("adminInscriptions.filterStatusAll")}</option>
                <option value="not_started">{t("adminInscriptions.statusNotStarted")}</option>
                <option value="in_progress">{t("adminInscriptions.statusInProgress")}</option>
                <option value="completed">{t("adminInscriptions.statusCompleted")}</option>
              </select>

              <div className="af-select-wrap">
                <label htmlFor="ae-page-size">{t("adminFormations.display")}</label>
                <select
                  id="ae-page-size"
                  className="af-select"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <ExportMenu
                onExportPDF={() => exportEnrollmentsPDF(filtered, t)}
                onExportCSV={() => exportEnrollmentsCSV(filtered, t)}
              />
            </div>
          </div>

          {/* ── Tableau ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
          ) : error ? (
            <div className="sd-empty-box">
              <p>{t("adminInscriptions.errors.generic")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sd-empty-box">
              <FiCheckSquare size={28} style={{ opacity: .3 }} />
              <p>{t("adminInscriptions.emptyState")}</p>
            </div>
          ) : (
            <>
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>{t("adminInscriptions.colStudent")}</th>
                      <th>{t("adminInscriptions.colFormation")}</th>
                      <th>{t("adminInscriptions.colStatus")}</th>
                      <th>{t("adminInscriptions.colProgress")}</th>
                      <th>{t("adminInscriptions.colDate")}</th>
                      <th>{t("adminInscriptions.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((enr) => (
                      <tr key={enr._id}>
                        <td className="af-cell-title">
                          <div className="af-formation-cell">
                            <div className="af-avatar af-avatar--placeholder" style={{ background: avatarColor(enr.student?.name) }}>
                              {enr.student?.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="au-user-cell">
                              <span className="af-formation-title-text">{enr.student?.name || "—"}</span>
                              <span className="au-user-email">{enr.student?.email || ""}</span>
                            </div>
                          </div>
                        </td>
                        <td>{enr.formation?.title || "—"}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[enr.overallStatus] || "badge-warning"}`}>
                            {t(STATUS_LABEL_KEY[enr.overallStatus] || "adminInscriptions.statusNotStarted")}
                          </span>
                        </td>
                        <td>{progressText(enr.weekProgress)}</td>
                        <td>{formatDate(enr.createdAt)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              className="af-icon-btn"
                              title={t("adminInscriptions.viewDetailAction")}
                              aria-label={t("adminInscriptions.viewDetailAction")}
                              onClick={() => setDetailTarget(enr)}
                            >
                              <FiEye size={16} />
                            </button>
                            <button
                              type="button"
                              className="af-icon-btn"
                              style={{ color: "#EF4444" }}
                              title={t("adminInscriptions.cancelAction")}
                              aria-label={t("adminInscriptions.cancelAction")}
                              onClick={() => openCancel(enr)}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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

      {/* ── Modale détail (progression semaine par semaine) ────────────────── */}
      {detailTarget && (
        <Modal title={t("adminInscriptions.detailModalTitle")} onClose={() => setDetailTarget(null)} maxWidth={480}>
          <div className="au-detail">
            <div className="au-detail-head">
              <div className="af-avatar af-avatar--placeholder au-detail-avatar" style={{ background: avatarColor(detailTarget.student?.name) }}>
                {detailTarget.student?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <div className="au-detail-name">{detailTarget.student?.name}</div>
                <div className="au-user-email">{detailTarget.student?.email}</div>
              </div>
            </div>

            <p className="au-detail-name" style={{ fontSize: "0.95rem", margin: "12px 0 6px" }}>
              {detailTarget.formation?.title}
            </p>
            <span className={`badge ${STATUS_BADGE[detailTarget.overallStatus] || "badge-warning"}`}>
              {t(STATUS_LABEL_KEY[detailTarget.overallStatus] || "adminInscriptions.statusNotStarted")}
            </span>

            <dl className="au-detail-list" style={{ marginTop: 16 }}>
              {(detailTarget.weekProgress || []).map((w) => (
                <div className="au-detail-row" key={w.weekNumber}>
                  <dt>{t("adminInscriptions.weekLabel", { n: w.weekNumber })}</dt>
                  <dd style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {w.status === "done" && <FiCheckCircle size={13} color="#10B981" />}
                    {t(STATUS_LABEL_KEY[w.status === "done" ? "completed" : w.status] || "adminInscriptions.statusNotStarted")}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Modal>
      )}

      {/* ── Modale annulation ────────────────────────────────────────────── */}
      {cancelTarget && (
        <Modal
          title={t("adminInscriptions.cancelModalTitle")}
          onClose={closeCancel}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeCancel} disabled={cancelling}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#EF4444" }} onClick={confirmCancel} disabled={cancelling}>
                {cancelling ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </>
          }
        >
          <p>
            {t("adminInscriptions.confirmCancelQuestion")} <strong>{cancelTarget.student?.name}</strong>
            {" "}({cancelTarget.formation?.title}) ?
            {" "}{t("adminFormations.irreversibleNotice")}
          </p>
          {cancelError && (
            <div className="af-form-error" style={{ marginTop: 14 }}>
              <FiAlertTriangle size={15} />
              <span>{cancelError}</span>
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}
