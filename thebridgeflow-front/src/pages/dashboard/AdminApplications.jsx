import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiFileText, FiAlertTriangle, FiCheck, FiX, FiCalendar,
  FiChevronLeft, FiChevronRight, FiSend,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import ExportMenu from "../../components/common/ExportMenu.jsx";
import { downloadCSV, exportSingleTablePDF } from "../../utils/exportTable.js";
import { applicationsService } from "../../services/applications.service.js";
import { interviewsService }   from "../../services/interviews.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminUsers.css";

const STATUS_BADGE = {
  "en attente": "badge-warning",
  "en cours":   "badge-primary",
  "acceptée":   "badge-success",
  "refusée":    "badge-danger",
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

function exportApplicationsCSV(rows, t) {
  const headers = [
    t("adminCandidatures.colStudent"), t("adminCandidatures.csvColEmail"), t("adminCandidatures.colOffer"),
    t("adminCandidatures.colCompany"), t("adminCandidatures.colDate"), t("adminCandidatures.colStatus"),
  ];
  const body = rows.map((a) => [
    a.studentId?.name, a.studentId?.email, a.offerId?.title,
    a.offerId?.companyName, formatDate(a.createdAt), t(`status.${a.status}`),
  ]);
  downloadCSV(`candidatures-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
}

function exportApplicationsPDF(rows, t) {
  const head = [
    t("adminCandidatures.colStudent"), t("adminCandidatures.colOffer"),
    t("adminCandidatures.colCompany"), t("adminCandidatures.colDate"), t("adminCandidatures.colStatus"),
  ];
  const body = rows.map((a) => [
    a.studentId?.name || "—", a.offerId?.title || "—",
    a.offerId?.companyName || "—", formatDate(a.createdAt), t(`status.${a.status}`),
  ]);
  exportSingleTablePDF({
    filename: `candidatures-${new Date().toISOString().slice(0, 10)}.pdf`,
    title: t("adminCandidatures.pdfTitle"),
    dateLabel: t("adminFormations.pdfExportedOn", { date: new Date().toLocaleDateString("fr-FR") }),
    head,
    body,
  });
}

/* Pré-remplit le message par défaut à partir de la date/heure/mode choisis —
   tant que l'admin n'a pas lui-même modifié le texte. */
function buildDefaultMessage(scheduledAt, mode) {
  if (!scheduledAt) return "";
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("fr-FR");
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const modeLabel = mode === "présentiel" ? "présentiel" : "en ligne";
  return `Nous vous proposons un entretien le ${date} à ${time} en ${modeLabel}. Merci de confirmer votre disponibilité.`;
}

/* ── Formulaire "Proposer un entretien" ─────────────────────────────────── */
function ProposeInterviewForm({ application, onCancel, onSubmitted, t }) {
  const [scheduledAt,    setScheduledAt]    = useState("");
  const [mode,           setMode]           = useState("en ligne");
  const [location,       setLocation]       = useState("");
  const [message,        setMessage]        = useState("");
  const [messageTouched, setMessageTouched] = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState("");

  useEffect(() => {
    if (messageTouched) return;
    setMessage(buildDefaultMessage(scheduledAt, mode));
  }, [scheduledAt, mode, messageTouched]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduledAt) {
      setError(t("adminCandidatures.errors.dateRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await interviewsService.propose({
        applicationId: application._id,
        scheduledAt:   new Date(scheduledAt).toISOString(),
        mode,
        location,
        notes: message.trim(),
      });
      onSubmitted();
    } catch (err) {
      setError(extractErrorMessage(err, t("adminCandidatures.errors.interviewFailed")));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewDateLabel")}</label>
        <input
          type="datetime-local"
          className="input"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewModeLabel")}</label>
        <select className="input" value={mode} onChange={(e) => { setMode(e.target.value); setLocation(""); }}>
          <option value="en ligne">{t("adminCandidatures.interviewModeOnline")}</option>
          <option value="présentiel">{t("adminCandidatures.interviewModeOnsite")}</option>
        </select>
      </div>

      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewLocationLabel")}</label>
        <input
          type="text"
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={
            mode === "présentiel"
              ? t("adminCandidatures.interviewLocationPlaceholderOnsite")
              : t("adminCandidatures.interviewLocationPlaceholderOnline")
          }
        />
      </div>

      <div className="af-form-row">
        <label className="label">{t("adminCandidatures.interviewMessageLabel")}</label>
        <textarea
          className="input"
          rows={4}
          value={message}
          onChange={(e) => { setMessage(e.target.value); setMessageTouched(true); }}
        />
      </div>

      {error && (
        <div className="af-form-error">
          <FiAlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <FiSend size={14} />
          {submitting ? t("adminCandidatures.interviewSubmitting") : t("adminCandidatures.interviewSubmit")}
        </button>
      </div>
    </form>
  );
}

export default function AdminApplications() {
  const { t } = useTranslation();

  const [applications, setApplications] = useState([]);
  const [loading,       setLoading]     = useState(true);
  const [error,         setError]       = useState(false);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("en attente");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [actionId,       setActionId]       = useState(null);
  const [rowActionError, setRowActionError] = useState("");
  const [interviewTarget, setInterviewTarget] = useState(null);

  const loadApplications = useCallback(() => {
    applicationsService.getAll()
      .then(({ data }) => { setApplications(data.applications || []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        (a.studentId?.name || "").toLowerCase().includes(q) ||
        (a.offerId?.title || "").toLowerCase().includes(q) ||
        (a.offerId?.companyName || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [applications, statusFilter, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleDecision = async (app, decision) => {
    setRowActionError("");
    setActionId(app._id);
    try {
      await applicationsService.updateStatus(app._id, decision === "accept" ? "acceptée" : "refusée");
      loadApplications();
    } catch (err) {
      setRowActionError(extractErrorMessage(err, t("adminCandidatures.errors.decisionFailed")));
    } finally {
      setActionId(null);
    }
  };

  const handleInterviewSubmitted = () => {
    setInterviewTarget(null);
    loadApplications();
  };

  return (
    <DashboardLayout title={t("sidebar.admin.candidatures")} subtitle={t("adminCandidatures.pageSubtitle")}>
      <div className="sd-root">
        <div className="af-card">

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar au-toolbar">
            <h1 className="af-toolbar-title">{t("sidebar.admin.candidatures")}</h1>
            <div className="af-toolbar-actions">
              <input
                type="search"
                className="input au-search"
                placeholder={t("adminCandidatures.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />

              <select
                className="af-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label={t("adminCandidatures.filterStatusAll")}
              >
                <option value="all">{t("adminCandidatures.filterStatusAll")}</option>
                <option value="en attente">{t("status.en attente")}</option>
                <option value="en cours">{t("status.en cours")}</option>
                <option value="acceptée">{t("status.acceptée")}</option>
                <option value="refusée">{t("status.refusée")}</option>
              </select>

              <div className="af-select-wrap">
                <label htmlFor="ac-page-size">{t("adminFormations.display")}</label>
                <select
                  id="ac-page-size"
                  className="af-select"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <ExportMenu
                onExportPDF={() => exportApplicationsPDF(filtered, t)}
                onExportCSV={() => exportApplicationsCSV(filtered, t)}
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
              <p>{t("adminCandidatures.errors.generic")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sd-empty-box">
              <FiFileText size={28} style={{ opacity: .3 }} />
              <p>{t("adminCandidatures.emptyState")}</p>
            </div>
          ) : (
            <>
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>{t("adminCandidatures.colStudent")}</th>
                      <th>{t("adminCandidatures.colOffer")}</th>
                      <th>{t("adminCandidatures.colCompany")}</th>
                      <th>{t("adminCandidatures.colDate")}</th>
                      <th>{t("adminCandidatures.colStatus")}</th>
                      <th>{t("adminCandidatures.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((app) => {
                      const isPending  = app.status === "en attente";
                      const isInReview = app.status === "en cours";
                      const isUpdating = actionId === app._id;
                      return (
                        <tr key={app._id}>
                          <td className="af-cell-title">
                            <div className="af-formation-cell">
                              <div className="af-avatar af-avatar--placeholder" style={{ background: avatarColor(app.studentId?.name) }}>
                                {app.studentId?.name?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div className="au-user-cell">
                                <span className="af-formation-title-text">{app.studentId?.name || "—"}</span>
                                <span className="au-user-email">{app.studentId?.email || ""}</span>
                              </div>
                            </div>
                          </td>
                          <td>{app.offerId?.title || "—"}</td>
                          <td>{app.offerId?.companyName || "—"}</td>
                          <td>{formatDate(app.createdAt)}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[app.status] || "badge-warning"}`}>
                              {t(`status.${app.status}`)}
                            </span>
                          </td>
                          <td>
                            {isPending ? (
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                disabled={isUpdating}
                                onClick={() => setInterviewTarget(app)}
                              >
                                <FiCalendar size={13} />
                                {t("adminCandidatures.proposeInterviewAction")}
                              </button>
                            ) : isInReview ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="af-icon-btn"
                                  style={{ color: "#10B981" }}
                                  disabled={isUpdating}
                                  title={t("adminCandidatures.acceptAction")}
                                  aria-label={t("adminCandidatures.acceptAction")}
                                  onClick={() => handleDecision(app, "accept")}
                                >
                                  <FiCheck size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="af-icon-btn"
                                  style={{ color: "#EF4444" }}
                                  disabled={isUpdating}
                                  title={t("adminCandidatures.rejectAction")}
                                  aria-label={t("adminCandidatures.rejectAction")}
                                  onClick={() => handleDecision(app, "reject")}
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
              <div className="af-table-hint">{t("common.swipeToSeeMore")}</div>

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

      {/* ── Modale proposer un entretien ─────────────────────────────────── */}
      {interviewTarget && (
        <Modal
          title={t("adminCandidatures.interviewModalTitle")}
          onClose={() => setInterviewTarget(null)}
          maxWidth={480}
        >
          <p style={{ marginBottom: 16 }}>
            <strong>{interviewTarget.studentId?.name}</strong>
            {" — "}
            {interviewTarget.offerId?.title}
          </p>
          <ProposeInterviewForm
            application={interviewTarget}
            onCancel={() => setInterviewTarget(null)}
            onSubmitted={handleInterviewSubmitted}
            t={t}
          />
        </Modal>
      )}
    </DashboardLayout>
  );
}
