import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FileText, TriangleAlert, ChevronLeft, ChevronRight, Eye, FolderOpen } from "lucide-react";
import Modal from "../../../components/common/Modal.jsx";
import AdminRowActions from "../../../components/common/AdminRowActions.jsx";
import ExportMenu from "../../../components/common/ExportMenu.jsx";
import { downloadCSV, exportSingleTablePDF } from "../../../utils/exportTable.js";
import { applicationsService } from "../../../services/applications.service.js";
import ProposeInterviewForm from "./ProposeInterviewForm.jsx";
import CandidateAvatar from "./shared/CandidateAvatar.jsx";
import { ApplicationStatusBadge } from "./shared/StatusBadges.jsx";
import "../StudentDashboard.css";
import "../AdminFormations.css";
import "../AdminUsers.css";

/* Vue « Par candidature » : la page historique (une ligne par candidature),
   reprise à l'identique — recherche, filtre de statut (« en attente » par
   défaut), pagination, export PDF/CSV, profil, entretien, décision — avec en
   plus l'accès direct au dossier de l'étudiant. Chargée uniquement quand
   l'administrateur ouvre cette vue. */

const PAGE_SIZES = [6, 10, 25, 50];

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

export default function ApplicationsView({ onDataChanged, pushToast }) {
  const { t } = useTranslation();
  const tl = (key, options) => t(`adminCandidates.list.applications.${key}`, options);
  const navigate = useNavigate();

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
  const [profileTarget, setProfileTarget] = useState(null);

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

  const openDossier = (app) => {
    const studentId = app.studentId?._id;
    if (!studentId) return;
    navigate(`/dashboard/admin/candidatures/etudiants/${studentId}`, { state: { from: "?vue=candidatures" } });
  };

  const handleDecision = async (app, decision) => {
    setRowActionError("");
    setActionId(app._id);
    try {
      await applicationsService.updateStatus(app._id, decision === "accept" ? "acceptée" : "refusée");
      loadApplications();
      onDataChanged?.();
      pushToast?.("success", decision === "accept" ? tl("acceptedToast", { name: app.studentId?.name || "" }) : tl("rejectedToast", { name: app.studentId?.name || "" }));
    } catch (err) {
      setRowActionError(extractErrorMessage(err, t("adminCandidatures.errors.decisionFailed")));
    } finally {
      setActionId(null);
    }
  };

  const handleInterviewSubmitted = () => {
    const name = interviewTarget?.studentId?.name || "";
    setInterviewTarget(null);
    loadApplications();
    onDataChanged?.();
    pushToast?.("success", tl("interviewToast", { name }));
  };

  return (
    <div className="sd-root cnd-apps">
      <div className="af-card">

        {/* ── Barre d'outils ─────────────────────────────────────────── */}
        <div className="af-toolbar au-toolbar">
          <h2 className="af-toolbar-title">{tl("title")}</h2>
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
            <TriangleAlert size={15} aria-hidden="true" />
            <span>{rowActionError}</span>
          </div>
        )}

        {/* ── Tableau ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
        ) : error ? (
          <div className="sd-empty-box">
            <p>{t("adminCandidatures.errors.generic")}</p>
            <button type="button" className="cnd-btn cnd-btn--secondary cnd-btn--sm" onClick={() => { setLoading(true); setError(false); loadApplications(); }}>
              {t("adminCandidates.common.actions.retry")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="sd-empty-box">
            <FileText size={28} style={{ opacity: .3 }} aria-hidden="true" />
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
                            <CandidateAvatar name={app.studentId?.name || ""} avatarUrl={app.studentId?.avatarUrl || ""} size="sm" />
                            <div className="au-user-cell">
                              <button type="button" className="af-formation-title-text ac-profile-trigger" onClick={() => setProfileTarget(app)}>
                                {app.studentId?.name || "—"} <Eye size={13} aria-hidden="true" />
                              </button>
                              <span className="au-user-email">{app.studentId?.email || ""}</span>
                            </div>
                          </div>
                        </td>
                        <td>{app.offerId?.title || "—"}</td>
                        <td>{app.offerId?.companyName || "—"}</td>
                        <td>{formatDate(app.createdAt)}</td>
                        <td><ApplicationStatusBadge status={app.status} /></td>
                        <td><AdminRowActions
                          ariaLabel={t("adminFormations.actionsAriaLabel")}
                          actions={[
                            ...(app.studentId?._id ? [{ label: t("adminCandidates.common.actions.openDossier"), onClick: () => openDossier(app) }] : []),
                            ...(isPending ? [{ label: t("adminCandidatures.proposeInterviewAction"), onClick: () => setInterviewTarget(app), disabled: isUpdating }] : []),
                            ...(isInReview ? [
                              { label: t("adminCandidatures.acceptAction"), onClick: () => handleDecision(app, "accept"), disabled: isUpdating },
                              { label: t("adminCandidatures.rejectAction"), onClick: () => handleDecision(app, "reject"), disabled: isUpdating, danger: true },
                            ] : []),
                          ]}
                        /></td>
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
                <ChevronLeft className="cnd-flip-rtl" size={14} aria-hidden="true" /> {t("offers.previous")}
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
                {t("offers.next")} <ChevronRight className="cnd-flip-rtl" size={14} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
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
      {profileTarget && (
        <Modal
          title={t("adminCandidatures.profile.title")}
          onClose={() => setProfileTarget(null)}
          maxWidth={760}
          footer={profileTarget.studentId?._id ? (
            <button type="button" className="cnd-btn cnd-btn--primary" onClick={() => { const app = profileTarget; setProfileTarget(null); openDossier(app); }}>
              <FolderOpen size={16} aria-hidden="true" />
              {tl("openFullDossier")}
            </button>
          ) : null}
        >
          <div className="ac-profile-details">
            <section>
              <h3>{t("adminCandidatures.profile.studentDetails")}</h3>
              <dl>
                {[["name", profileTarget.studentId?.name], ["email", profileTarget.studentId?.email],
                  ["phone", profileTarget.studentId?.phone], ["university", profileTarget.studentId?.university],
                  ["specialty", profileTarget.studentId?.specialty], ["gender", profileTarget.studentId?.gender],
                  ["bio", profileTarget.studentId?.bio]].map(([label, value]) => (
                  <div key={label}><dt>{t(`adminCandidatures.profile.${label}`)}</dt><dd>{value || t("adminCandidatures.profile.notProvided")}</dd></div>
                ))}
                <div><dt>{t("adminCandidatures.profile.education")}</dt><dd>{[
                  profileTarget.studentId?.education?.degree,
                  profileTarget.studentId?.education?.fieldOfStudy,
                  profileTarget.studentId?.education?.institution,
                  profileTarget.studentId?.education?.grade,
                  profileTarget.studentId?.education?.startDate && formatDate(profileTarget.studentId.education.startDate),
                  profileTarget.studentId?.education?.endDate && formatDate(profileTarget.studentId.education.endDate),
                  profileTarget.studentId?.education?.current && t("profileEditor.current"),
                  ...(profileTarget.studentId?.education?.courses || []),
                ].filter(Boolean).join(" · ") || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.experience")}</dt><dd>{profileTarget.studentId?.experience?.map((item) => [
                  item.position, item.company, item.location,
                  [item.startDate && formatDate(item.startDate), item.current ? t("profileEditor.current") : item.endDate && formatDate(item.endDate)].filter(Boolean).join(" – "),
                  item.description, ...(item.technologies || []),
                ].filter(Boolean).join(" — ")).filter(Boolean).join("; ") || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.skills")}</dt><dd>{profileTarget.studentId?.skills?.map((skill) => [skill.name, skill.level].filter(Boolean).join(" — ")).filter(Boolean).join(", ") || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.languages")}</dt><dd>{profileTarget.studentId?.languages?.map((language) => [language.name, language.level].filter(Boolean).join(" — ")).filter(Boolean).join(", ") || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.socialLinks")}</dt><dd>{Object.entries(profileTarget.studentId?.socialLinks || {}).filter(([, url]) => url).map(([key, url]) => `${key}: ${url}`).join(" · ") || t("adminCandidatures.profile.notProvided")}</dd></div>
              </dl>
            </section>
            <section>
              <h3>{t("adminCandidatures.profile.applicationDetails")}</h3>
              <dl>
                <div><dt>{t("adminCandidatures.profile.offer")}</dt><dd>{profileTarget.offerId?.title || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.company")}</dt><dd>{profileTarget.offerId?.companyName || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.status")}</dt><dd>{t(`status.${profileTarget.status}`)}</dd></div>
                <div><dt>{t("adminCandidatures.profile.submitted")}</dt><dd>{formatDate(profileTarget.createdAt)}</dd></div>
                <div><dt>{t("adminCandidatures.profile.applicationNote")}</dt><dd>{profileTarget.note || t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.cv")}</dt><dd>{profileTarget.cvUrl ? <a href={profileTarget.cvUrl} target="_blank" rel="noreferrer">{t("adminCandidatures.profile.openDocument")}</a> : profileTarget.studentId?.cv?.fileUrl ? <a href={profileTarget.studentId.cv.fileUrl} target="_blank" rel="noreferrer">{profileTarget.studentId.cv.fileName || "CV"}</a> : t("adminCandidatures.profile.notProvided")}</dd></div>
                <div><dt>{t("adminCandidatures.profile.coverLetter")}</dt><dd>{profileTarget.coverLetterUrl ? <a href={profileTarget.coverLetterUrl} target="_blank" rel="noreferrer">{profileTarget.coverLetterName || t("adminCandidatures.profile.openDocument")}</a> : profileTarget.coverLetter || t("adminCandidatures.profile.notProvided")}</dd></div>
              </dl>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
