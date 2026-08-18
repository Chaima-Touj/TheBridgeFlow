import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FiAward, FiAlertTriangle, FiCheck, FiX, FiFlag, FiRefreshCw, FiTrendingUp } from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import ExportMenu from "../../components/common/ExportMenu.jsx";
import Modal from "../../components/common/Modal.jsx";
import { downloadCSV, exportSingleTablePDF } from "../../utils/exportTable.js";
import { ceremonyService } from "../../services/ceremony.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminUsers.css";

const STATUS_BADGE = {
  en_attente: "badge-warning",
  "approuvé": "badge-success",
  "refusé":   "badge-danger",
};
const STATUS_LABEL_KEY = {
  en_attente: "adminCeremony.statusPending",
  "approuvé": "adminCeremony.statusApproved",
  "refusé":   "adminCeremony.statusRejected",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

// <input type="date"> attend YYYY-MM-DD — ni undefined/null ni un ISO complet.
function toDateInputValue(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function exportProjectsCSV(rows, t) {
  const headers = [
    t("adminCeremony.csvColProject"), t("adminCeremony.csvColAuthor"),
    t("adminCeremony.csvColVotes"), t("adminCeremony.csvColStatus"), t("adminCeremony.colDate"),
  ];
  const body = rows.map((p) => [
    p.title, p.studentId?.name || "—", p.voteCount, t(STATUS_LABEL_KEY[p.status] || p.status), formatDate(p.createdAt),
  ]);
  downloadCSV(`ceremonie-projets-${new Date().toISOString().slice(0, 10)}.csv`, headers, body);
}

function exportProjectsPDF(rows, t) {
  const head = [
    t("adminCeremony.csvColProject"), t("adminCeremony.csvColAuthor"),
    t("adminCeremony.csvColVotes"), t("adminCeremony.csvColStatus"), t("adminCeremony.colDate"),
  ];
  const body = rows.map((p) => [
    p.title, p.studentId?.name || "—", String(p.voteCount), t(STATUS_LABEL_KEY[p.status] || p.status), formatDate(p.createdAt),
  ]);
  exportSingleTablePDF({
    filename: `ceremonie-projets-${new Date().toISOString().slice(0, 10)}.pdf`,
    title: t("adminCeremony.pdfTitle"),
    dateLabel: t("adminFormations.pdfExportedOn", { date: new Date().toLocaleDateString("fr-FR") }),
    head,
    body,
  });
}

export default function AdminCeremony() {
  const { t } = useTranslation();

  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [actionId, setActionId] = useState(null);
  const [rowActionError, setRowActionError] = useState("");

  const [settings,      setSettings]      = useState(null);
  const [settingsForm,  setSettingsForm]  = useState({ voteStartDate: "", voteEndDate: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError,  setSettingsError]  = useState("");
  const [settingsSaved,  setSettingsSaved]  = useState(false);
  const [reopening,      setReopening]      = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing,        setClosing]        = useState(false);
  const [closeResult,    setCloseResult]    = useState(null); // undefined tant que non exécuté, null/objet ensuite
  const [closeError,     setCloseError]     = useState("");

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetChecked,   setResetChecked]   = useState(false);
  const [resetting,      setResetting]      = useState(false);
  const [resetError,     setResetError]     = useState("");

  const loadProjects = useCallback(() => {
    ceremonyService.getAdminProjects()
      .then(({ data }) => { setProjects(data.projects || []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const loadSettings = useCallback(() => {
    ceremonyService.getSettings()
      .then(({ data }) => {
        setSettings(data);
        setSettingsForm({
          voteStartDate: toDateInputValue(data.voteStartDate),
          voteEndDate:   toDateInputValue(data.voteEndDate),
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadProjects(); loadSettings(); }, [loadProjects, loadSettings]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) || (p.studentId?.name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, statusFilter, search]);

  const handleDecision = async (project, decision) => {
    setRowActionError("");
    setActionId(project._id);
    try {
      if (decision === "accept") await ceremonyService.acceptProject(project._id);
      else                        await ceremonyService.rejectProject(project._id);
      loadProjects();
    } catch (err) {
      setRowActionError(extractErrorMessage(err, t("adminCeremony.errors.decisionFailed")));
    } finally {
      setActionId(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsError("");
    setSettingsSaved(false);
    try {
      const { data } = await ceremonyService.updateSettings({
        voteStartDate: settingsForm.voteStartDate || null,
        voteEndDate:   settingsForm.voteEndDate   || null,
      });
      setSettings(data);
      setSettingsSaved(true);
    } catch (err) {
      setSettingsError(extractErrorMessage(err, t("adminCeremony.errors.settingsFailed")));
    } finally {
      setSavingSettings(false);
    }
  };

  const openCloseModal = () => { setCloseResult(undefined); setCloseError(""); setShowCloseModal(true); };
  const handleCloseAndAnnounce = async () => {
    setClosing(true);
    setCloseError("");
    try {
      const { data } = await ceremonyService.closeAndAnnounce();
      setSettings(data.settings);
      setCloseResult(data.winner || null);
    } catch (err) {
      setCloseError(extractErrorMessage(err, t("adminCeremony.errors.closeFailed")));
    } finally {
      setClosing(false);
    }
  };

  const handleReopenVote = async () => {
    setReopening(true);
    setSettingsError("");
    try {
      const { data } = await ceremonyService.updateSettings({ isVoteClosed: false });
      setSettings(data);
    } catch (err) {
      setSettingsError(extractErrorMessage(err, t("adminCeremony.errors.settingsFailed")));
    } finally {
      setReopening(false);
    }
  };

  const closeResetModal = () => { setShowResetModal(false); setResetChecked(false); setResetError(""); };
  const handleResetVotes = async () => {
    setResetting(true);
    setResetError("");
    try {
      await ceremonyService.resetVotes();
      closeResetModal();
      loadProjects();
    } catch (err) {
      setResetError(extractErrorMessage(err, t("adminCeremony.errors.resetFailed")));
    } finally {
      setResetting(false);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.ceremony")} subtitle={t("adminCeremony.pageSubtitle")}>
      <div className="sd-root">

        {/* ── Config période de vote + clôture/reset ─────────────────────── */}
        <div className="af-card" style={{ marginBottom: 20, padding: 20 }}>
          <h2 className="af-toolbar-title" style={{ marginBottom: 16 }}>{t("adminCeremony.settingsTitle")}</h2>

          {settings?.isVoteClosed && (
            <div className="af-form-error" style={{ background: "var(--bg)", color: "var(--text-secondary)", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiFlag size={15} />
                {t("adminCeremony.voteClosedNotice")}
                {settings.winnerProjectId?.title && ` — ${t("adminCeremony.winnerIs", { title: settings.winnerProjectId.title })}`}
              </span>
              <button type="button" className="btn btn-ghost" disabled={reopening} onClick={handleReopenVote}>
                {reopening ? t("adminCeremony.saving") : t("adminCeremony.reopenVote")}
              </button>
            </div>
          )}

          <div className="af-form-grid">
            <div className="af-form-row">
              <label className="label" htmlFor="ac-start">{t("adminCeremony.voteStartLabel")}</label>
              <input
                id="ac-start"
                type="date"
                className="input"
                value={settingsForm.voteStartDate}
                onChange={(e) => { setSettingsForm((f) => ({ ...f, voteStartDate: e.target.value })); setSettingsSaved(false); }}
              />
            </div>
            <div className="af-form-row">
              <label className="label" htmlFor="ac-end">{t("adminCeremony.voteEndLabel")}</label>
              <input
                id="ac-end"
                type="date"
                className="input"
                value={settingsForm.voteEndDate}
                onChange={(e) => { setSettingsForm((f) => ({ ...f, voteEndDate: e.target.value })); setSettingsSaved(false); }}
              />
            </div>
          </div>
          {settingsError && <span className="af-field-error">{settingsError}</span>}

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn btn-primary" disabled={savingSettings} onClick={handleSaveSettings}>
              {savingSettings ? t("adminCeremony.saving") : t("adminCeremony.saveSettings")}
            </button>
            {settingsSaved && (
              <span style={{ color: "var(--secondary)", fontSize: "0.85rem", fontWeight: 600 }}>
                {t("adminCeremony.settingsSaved")}
              </span>
            )}

            <button
              type="button"
              className="btn btn-outline"
              disabled={settings?.isVoteClosed}
              onClick={openCloseModal}
              style={{ marginInlineStart: "auto" }}
            >
              <FiFlag size={14} /> {t("adminCeremony.closeAndAnnounce")}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: "#DC2626", borderColor: "#DC2626" }}
              onClick={() => setShowResetModal(true)}
            >
              <FiRefreshCw size={14} /> {t("adminCeremony.resetVotes")}
            </button>
          </div>
        </div>

        {/* ── Liste des projets ────────────────────────────────────────────── */}
        <div className="af-card">
          <div className="af-toolbar au-toolbar">
            <h1 className="af-toolbar-title">{t("adminCeremony.projectsTitle")}</h1>
            <div className="af-toolbar-actions">
              <input
                type="search"
                className="input au-search"
                placeholder={t("adminCeremony.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="af-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={t("adminCeremony.filterStatusAll")}
              >
                <option value="all">{t("adminCeremony.filterStatusAll")}</option>
                <option value="en_attente">{t("adminCeremony.statusPending")}</option>
                <option value="approuvé">{t("adminCeremony.statusApproved")}</option>
                <option value="refusé">{t("adminCeremony.statusRejected")}</option>
              </select>

              <ExportMenu
                onExportPDF={() => exportProjectsPDF(filtered, t)}
                onExportCSV={() => exportProjectsCSV(filtered, t)}
              />
            </div>
          </div>

          {rowActionError && (
            <div className="af-form-error" style={{ margin: "0 20px 16px" }}>
              <FiAlertTriangle size={15} />
              <span>{rowActionError}</span>
            </div>
          )}

          {loading ? (
            <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
          ) : error ? (
            <div className="sd-empty-box">
              <p>{t("adminCeremony.errors.generic")}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sd-empty-box">
              <FiAward size={28} style={{ opacity: .3 }} />
              <p>{t("adminCeremony.emptyState")}</p>
            </div>
          ) : (
            <div className="af-table-wrap">
              <table className="af-table">
                <thead>
                  <tr>
                    <th>{t("adminCeremony.colProject")}</th>
                    <th>{t("adminCeremony.colAuthor")}</th>
                    <th>{t("adminCeremony.colVotes")}</th>
                    <th>{t("adminCeremony.colStatus")}</th>
                    <th>{t("adminCeremony.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isUpdating = actionId === p._id;
                    return (
                      <tr key={p._id}>
                        <td className="af-cell-title">
                          <span className="af-formation-title-text">{p.title}</span>
                        </td>
                        <td>{p.studentId?.name || "—"}</td>
                        <td>
                          <span className="md-chip" style={{ display: "inline-flex" }}>
                            <FiTrendingUp size={11} /> {p.voteCount}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[p.status] || "badge-warning"}`}>
                            {t(STATUS_LABEL_KEY[p.status] || "adminCeremony.statusPending")}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              className="af-icon-btn"
                              style={{ color: "#10B981" }}
                              disabled={isUpdating || p.status === "approuvé"}
                              title={t("adminCeremony.acceptAction")}
                              aria-label={t("adminCeremony.acceptAction")}
                              onClick={() => handleDecision(p, "accept")}
                            >
                              <FiCheck size={16} />
                            </button>
                            <button
                              type="button"
                              className="af-icon-btn"
                              style={{ color: "#EF4444" }}
                              disabled={isUpdating || p.status === "refusé"}
                              title={t("adminCeremony.rejectAction")}
                              aria-label={t("adminCeremony.rejectAction")}
                              onClick={() => handleDecision(p, "reject")}
                            >
                              <FiX size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modale clôture + annonce du gagnant ──────────────────────────── */}
      {showCloseModal && (
        <Modal
          title={t("adminCeremony.closeModalTitle")}
          onClose={() => setShowCloseModal(false)}
          footer={
            closeResult === undefined ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCloseModal(false)}>
                  {t("adminCeremony.cancel")}
                </button>
                <button type="button" className="btn btn-primary" disabled={closing} onClick={handleCloseAndAnnounce}>
                  {closing ? t("adminCeremony.saving") : t("adminCeremony.confirmClose")}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setShowCloseModal(false)}>
                {t("adminCeremony.close")}
              </button>
            )
          }
        >
          {closeResult === undefined ? (
            <p>{t("adminCeremony.closeWarning")}</p>
          ) : closeResult ? (
            <p>{t("adminCeremony.winnerAnnounced", { title: closeResult.title })}</p>
          ) : (
            <p>{t("adminCeremony.noWinner")}</p>
          )}
          {closeError && <span className="af-field-error">{closeError}</span>}
        </Modal>
      )}

      {/* ── Modale reset des votes — double confirmation (case à cocher +
          bouton dédié) vu le caractère destructif et irréversible. ───────── */}
      {showResetModal && (
        <Modal
          title={t("adminCeremony.resetModalTitle")}
          onClose={closeResetModal}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeResetModal}>
                {t("adminCeremony.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: "#DC2626" }}
                disabled={!resetChecked || resetting}
                onClick={handleResetVotes}
              >
                {resetting ? t("adminCeremony.saving") : t("adminCeremony.confirmReset")}
              </button>
            </>
          }
        >
          <p>{t("adminCeremony.resetWarning")}</p>
          <label className="af-checkbox-label">
            <input type="checkbox" checked={resetChecked} onChange={(e) => setResetChecked(e.target.checked)} />
            {t("adminCeremony.resetConfirmCheckbox")}
          </label>
          {resetError && <span className="af-field-error">{resetError}</span>}
        </Modal>
      )}
    </DashboardLayout>
  );
}
