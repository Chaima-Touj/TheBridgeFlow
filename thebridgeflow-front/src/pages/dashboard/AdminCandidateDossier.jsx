import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft, History, BriefcaseBusiness, UserRound, FolderOpen, MessageSquareText, X, RotateCw, TriangleAlert, UserRoundX,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import DestructiveActionModal from "../../components/common/DestructiveActionModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { candidatesService } from "../../services/candidates.service.js";
import { applicationsService } from "../../services/applications.service.js";
import ProposeInterviewForm from "./candidatures/ProposeInterviewForm.jsx";
import { ICON_SIZE, ICON_STROKE } from "./candidatures/candidatesConfig.js";
import { getApiErrorCode, getApiErrorMessage, isNetworkError, resolveLocale } from "./candidatures/candidatesUtils.js";
import { CndToastViewport } from "./candidatures/shared/CndToast.jsx";
import { useCndToast } from "./candidatures/shared/useCndToast.js";
import EmptyState from "./candidatures/shared/EmptyState.jsx";
import Skeleton from "./candidatures/shared/Skeleton.jsx";
import DossierHero from "./candidatures/dossier/DossierHero.jsx";
import DossierAside from "./candidatures/dossier/DossierAside.jsx";
import TaskTimeline from "./candidatures/dossier/TaskTimeline.jsx";
import TaskFormModal from "./candidatures/dossier/TaskFormModal.jsx";
import ApplicationsPanel from "./candidatures/dossier/ApplicationsPanel.jsx";
import ProfilePanel from "./candidatures/dossier/ProfilePanel.jsx";
import DocumentsPanel, { DocumentPreviewModal } from "./candidatures/dossier/DocumentsPanel.jsx";
import { CompletionConfirmModal, DecisionConfirmModal } from "./candidatures/dossier/ConfirmModals.jsx";
import { useDossierData } from "./candidatures/dossier/useDossierData.js";
import { useDocumentActions } from "./candidatures/dossier/useDocumentActions.js";
import { useNow } from "./candidatures/dossier/useNow.js";
import { DEFAULT_TIMELINE_FILTERS } from "./candidatures/dossier/dossierUtils.js";
import "./candidatures/shared/candidatesShared.css";
import "./candidatures/dossier/CandidateDossier.css";
import "./AdminFormations.css";

const TABS = [
  { key: "suivi", Icon: History },
  { key: "candidatures", Icon: BriefcaseBusiness },
  { key: "profil", Icon: UserRound },
  { key: "documents", Icon: FolderOpen },
];

function DossierSkeleton() {
  return (
    <div className="cnd-dos-skeleton" aria-hidden="true">
      <div className="cnd-dos-hero cnd-dos-hero--skeleton">
        <div className="cnd-dos-hero__main">
          <Skeleton width={88} height={88} circle />
          <div className="cnd-dos-skeleton__lines">
            <Skeleton width="40%" height={22} />
            <Skeleton width="65%" height={13} />
            <Skeleton width="50%" height={13} />
          </div>
        </div>
        <div className="cnd-dos-kpis">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} height={52} />)}
        </div>
      </div>
      <div className="cnd-dos-layout">
        <div className="cnd-dos-main">
          <Skeleton height={44} />
          {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={120} style={{ marginTop: 14 }} />)}
        </div>
        <div className="cnd-dos-aside"><Skeleton height={180} /><Skeleton height={110} style={{ marginTop: 14 }} /></div>
      </div>
    </div>
  );
}

function DossierPage({ studentId }) {
  const { t, i18n } = useTranslation();
  const td = (key, options) => t(`adminCandidates.dossier.${key}`, options);
  const tc = (key, options) => t(`adminCandidates.common.${key}`, options);
  const locale = resolveLocale(i18n.resolvedLanguage || i18n.language);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const now = useNow();
  const { dossier, tasks, summary, error, loading, reload, silentRefresh, applyTask, dropTask } = useDossierData(studentId);
  const { toasts, pushToast, dismissToast } = useCndToast();

  const tabParam = searchParams.get("onglet");
  const tab = TABS.some((item) => item.key === tabParam) ? tabParam : "suivi";
  const from = typeof location.state?.from === "string" && (location.state.from === "" || location.state.from.startsWith("?")) ? location.state.from : "";
  const backHref = `/dashboard/admin/candidatures${from}`;

  const [filters, setFilters] = useState(DEFAULT_TIMELINE_FILTERS);
  const [taskModal, setTaskModal] = useState(null);
  const [contactBanner, setContactBanner] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [busyTaskId, setBusyTaskId] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [decision, setDecision] = useState(null);
  const [interviewTarget, setInterviewTarget] = useState(null);
  const tabRefs = useRef({});

  const errorMessage = useCallback((requestError, fallbackKey = "errors.generic") => {
    if (isNetworkError(requestError)) return t("adminCandidates.common.errors.network");
    if (requestError?.response?.status === 429) return t("adminCandidates.common.errors.rateLimited");
    return getApiErrorMessage(requestError, t(`adminCandidates.common.${fallbackKey}`));
  }, [t]);

  const onDocumentError = useCallback((kind, message) => {
    if (kind === "network") pushToast("error", t("adminCandidates.common.errors.network"));
    else if (kind === "unavailable") pushToast("error", t("adminCandidates.dossier.documents.unavailable"));
    else pushToast("error", message || t("adminCandidates.common.errors.generic"));
  }, [pushToast, t]);
  const documentsApi = useDocumentActions(studentId, { onError: onDocumentError });

  const setTab = (next) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next === "suivi") params.delete("onglet");
      else params.set("onglet", next);
      return params;
    }, { replace: true, state: location.state });
  };

  // Mise en évidence + défilement vers une tâche (ajout, échéance cliquée…).
  useEffect(() => {
    if (!highlightId) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`cnd-task-${highlightId}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    });
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [highlightId, tab]);

  const focusTask = (taskId) => {
    setFilters((previous) => ({ ...DEFAULT_TIMELINE_FILTERS, order: previous.order }));
    if (tab !== "suivi") setTab("suivi");
    setHighlightId(taskId);
  };

  const handleSaved = (task, nextSummary, { created, duplicate }) => {
    applyTask(task, nextSummary);
    setTaskModal(null);
    setContactBanner(null);
    pushToast("success", duplicate
      ? td("toast.taskAlreadySaved")
      : created ? td("toast.taskCreated", { name: dossier?.student?.name || "" }) : td("toast.taskUpdated"));
    focusTask(task._id);
    silentRefresh({ tasks: false });
  };

  const handleConflict = (kind) => {
    setTaskModal(null);
    pushToast("error", kind === "conflict" ? tc("errors.conflict") : tc("errors.notFound"));
    silentRefresh();
  };

  const handleTaskError = (requestError) => {
    const code = getApiErrorCode(requestError);
    if (code === "TASK_CONFLICT") { pushToast("error", tc("errors.conflict")); silentRefresh(); return; }
    if (requestError?.response?.status === 404) { pushToast("error", tc("errors.notFound")); silentRefresh(); return; }
    if (code === "TASK_DELETE_FORBIDDEN") { pushToast("error", td("toast.deleteForbidden")); return; }
    pushToast("error", errorMessage(requestError));
  };

  const patchTask = async (task, payload) => {
    setBusyTaskId(task._id);
    try {
      const { data } = await candidatesService.updateTask(studentId, task._id, { ...payload, expectedUpdatedAt: task.updatedAt });
      applyTask(data.task, data.summary);
      setHighlightId(data.task._id);
      pushToast("success", td("toast.statusChanged", { status: tc(`taskStatus.${data.task.status}`) }));
      silentRefresh({ tasks: false });
      return true;
    } catch (requestError) {
      handleTaskError(requestError);
      return false;
    } finally {
      setBusyTaskId(null);
    }
  };

  const changeStatus = (task, status) => {
    if (status === task.status) return;
    if (status === "completed" && task.type !== "note") {
      setCompletion({ task, loading: false, error: "" });
      return;
    }
    patchTask(task, { status });
  };

  const confirmCompletion = async () => {
    if (!completion || completion.loading) return;
    setCompletion((value) => ({ ...value, loading: true, error: "" }));
    // Succès ou échec (toast explicite dans patchTask) : la modale se ferme, la
    // tâche affichée reflète toujours l'état réellement enregistré.
    await patchTask(completion.task, { status: "completed", confirmCompletion: true });
    setCompletion(null);
  };

  const confirmDelete = async () => {
    if (!deletion || deletion.loading) return;
    setDeletion((value) => ({ ...value, loading: true, error: "" }));
    try {
      const { data } = await candidatesService.deleteTask(studentId, deletion.task._id);
      dropTask(deletion.task._id, data.summary);
      setDeletion(null);
      pushToast("success", td("toast.taskDeleted"));
      silentRefresh({ tasks: false });
    } catch (requestError) {
      const forbidden = getApiErrorCode(requestError) === "TASK_DELETE_FORBIDDEN";
      setDeletion((value) => (value ? { ...value, loading: false, error: forbidden ? td("toast.deleteForbidden") : errorMessage(requestError) } : value));
    }
  };

  const confirmDecision = async () => {
    if (!decision || decision.loading) return;
    setDecision((value) => ({ ...value, loading: true, error: "" }));
    try {
      await applicationsService.updateStatus(decision.application._id, decision.decision === "accept" ? "acceptée" : "refusée");
      pushToast("success", td(decision.decision === "accept" ? "toast.accepted" : "toast.rejected"));
      setDecision(null);
      silentRefresh();
    } catch (requestError) {
      setDecision((value) => (value ? { ...value, loading: false, error: getApiErrorMessage(requestError, t("adminCandidatures.errors.decisionFailed")) } : value));
    }
  };

  const openApplicationDocument = (doc) => {
    if (doc.available) documentsApi.openPreview(doc);
    else if (doc.externalUrl) window.open(doc.externalUrl, "_blank", "noopener,noreferrer");
  };

  const onTabKeyDown = (event) => {
    const index = TABS.findIndex((item) => item.key === tab);
    const rtl = document.documentElement.dir === "rtl";
    let nextIndex = null;
    if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) nextIndex = (index + 1) % TABS.length;
    if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = TABS[nextIndex].key;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  if (!dossier) {
    if (loading || !error) {
      return <div className="cnd-scope cnd-dos"><DossierSkeleton /></div>;
    }
    return (
      <div className="cnd-scope cnd-dos">
        <Link className="cnd-dos-back" to={backHref}><ArrowLeft className="cnd-flip-rtl" size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />{td("back")}</Link>
        <div className="cnd-card cnd-dos-state">
          {error === "notFound" ? (
            <EmptyState
              icon={UserRoundX}
              title={td("notFoundTitle")}
              description={td("notFoundText")}
              action={<Link className="cnd-btn cnd-btn--primary" to={backHref}>{td("back")}</Link>}
            />
          ) : (
            <EmptyState
              icon={TriangleAlert}
              title={td("loadErrorTitle")}
              description={error === "network" ? tc("errors.network") : error === "rateLimited" ? tc("errors.rateLimited") : tc("errors.generic")}
              action={(
                <button type="button" className="cnd-btn cnd-btn--primary" onClick={reload}>
                  <RotateCw size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />{tc("actions.retry")}
                </button>
              )}
            />
          )}
        </div>
      </div>
    );
  }

  const { student, applications, documents, systemEvents, globalStatus } = dossier;
  const openCount = (summary?.pending || 0) + (summary?.in_progress || 0);
  const tabCounts = { suivi: openCount, candidatures: applications.length, profil: null, documents: documents.length };

  return (
    <div className="cnd-scope cnd-dos">
      <Link className="cnd-dos-back" to={backHref}>
        <ArrowLeft className="cnd-flip-rtl" size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
        {td("back")}
      </Link>

      <DossierHero
        student={student}
        globalStatus={globalStatus}
        summary={summary}
        applicationsCount={applications.length}
        locale={locale}
        onAddTask={() => setTaskModal({ mode: "create", preset: {} })}
        onContact={(type) => setContactBanner(type)}
      />

      <AnimatePresence>
        {contactBanner && (
          <motion.div
            className="cnd-dos-banner"
            role="status"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            <span className="cnd-icon-tile cnd-icon-tile--sm cnd-tone--blue" aria-hidden="true"><MessageSquareText size={15} strokeWidth={ICON_STROKE} /></span>
            <p>{td("banner.text", { name: student.name, channel: td(`banner.channel.${contactBanner}`) })}</p>
            <div className="cnd-dos-banner__actions">
              <button
                type="button"
                className="cnd-btn cnd-btn--primary cnd-btn--sm"
                onClick={() => setTaskModal({ mode: "create", preset: { type: contactBanner, status: "in_progress" } })}
              >
                {td("banner.log")}
              </button>
              <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--sm cnd-btn--icon" onClick={() => setContactBanner(null)} aria-label={td("banner.dismiss")}>
                <X size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="cnd-dos-layout">
        <div className="cnd-dos-main">
          <div className="cnd-dos-tabs" role="tablist" aria-label={td("tabsLabel")} onKeyDown={onTabKeyDown}>
            {TABS.map(({ key, Icon }) => {
              const selected = tab === key;
              return (
                <button
                  key={key}
                  ref={(node) => { tabRefs.current[key] = node; }}
                  type="button"
                  role="tab"
                  id={`cnd-dos-tab-${key}`}
                  aria-selected={selected}
                  aria-controls={`cnd-dos-panel-${key}`}
                  tabIndex={selected ? 0 : -1}
                  className={`cnd-dos-tab ${selected ? "cnd-dos-tab--active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  <span>{td(`tabs.${key}`)}</span>
                  {typeof tabCounts[key] === "number" && <span className="cnd-dos-tab__count cnd-num">{tabCounts[key]}</span>}
                  {selected && <motion.span layoutId="cnd-dos-tab-underline" className="cnd-dos-tab__underline" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              role="tabpanel"
              id={`cnd-dos-panel-${tab}`}
              aria-labelledby={`cnd-dos-tab-${tab}`}
              className="cnd-dos-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "suivi" && (
                <TaskTimeline
                  tasks={tasks}
                  systemEvents={systemEvents}
                  applications={applications}
                  filters={filters}
                  onFiltersChange={setFilters}
                  now={now}
                  locale={locale}
                  currentUserId={user?._id}
                  busyTaskId={busyTaskId}
                  highlightId={highlightId}
                  onStatusChange={changeStatus}
                  onEdit={(task) => setTaskModal({ mode: "edit", task })}
                  onDelete={(task) => setDeletion({ task, loading: false, error: "" })}
                  onAddTask={() => setTaskModal({ mode: "create", preset: {} })}
                />
              )}
              {tab === "candidatures" && (
                <ApplicationsPanel
                  applications={applications}
                  documents={documents}
                  locale={locale}
                  onProposeInterview={(application) => setInterviewTarget(application)}
                  onDecision={(application, value) => setDecision({ application, decision: value, loading: false, error: "" })}
                  onAddLinkedTask={(application) => setTaskModal({ mode: "create", preset: { applicationId: application._id } })}
                  onShowHistory={(application) => {
                    setFilters((previous) => ({ ...DEFAULT_TIMELINE_FILTERS, order: previous.order, applicationId: String(application._id) }));
                    setTab("suivi");
                  }}
                  onPreviewDocument={openApplicationDocument}
                />
              )}
              {tab === "profil" && <ProfilePanel student={student} locale={locale} />}
              {tab === "documents" && (
                <DocumentsPanel documents={documents} busy={documentsApi.busy} onPreview={documentsApi.openPreview} onDownload={documentsApi.download} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <DossierAside
          tasks={tasks}
          documents={documents}
          now={now}
          locale={locale}
          busy={documentsApi.busy}
          onSelectTask={(task) => focusTask(task._id)}
          onPreview={documentsApi.openPreview}
          onDownload={documentsApi.download}
        />
      </div>

      {taskModal && (
        <TaskFormModal
          mode={taskModal.mode}
          task={taskModal.task}
          preset={taskModal.preset}
          studentId={studentId}
          student={student}
          applications={applications}
          onClose={() => setTaskModal(null)}
          onSaved={handleSaved}
          onConflict={handleConflict}
          onProposeInterview={(application) => { setTaskModal(null); setInterviewTarget(application); }}
        />
      )}

      {completion && (
        <CompletionConfirmModal
          task={completion.task}
          loading={completion.loading}
          error={completion.error}
          onCancel={() => setCompletion(null)}
          onConfirm={confirmCompletion}
        />
      )}

      {deletion && (
        <DestructiveActionModal
          title={td("delete.title")}
          description={td("delete.description")}
          itemName={deletion.task.title}
          consequence={td("delete.consequence")}
          error={deletion.error}
          isLoading={deletion.loading}
          confirmLabel={td("delete.confirm")}
          loadingLabel={td("delete.loading")}
          cancelLabel={tc("actions.cancel")}
          onCancel={() => setDeletion(null)}
          onConfirm={confirmDelete}
        />
      )}

      {decision && (
        <DecisionConfirmModal
          application={decision.application}
          decision={decision.decision}
          loading={decision.loading}
          error={decision.error}
          studentName={student.name}
          onCancel={() => setDecision(null)}
          onConfirm={confirmDecision}
        />
      )}

      {interviewTarget && (
        <Modal title={t("adminCandidatures.interviewModalTitle")} onClose={() => setInterviewTarget(null)} maxWidth={480}>
          <p style={{ marginBottom: 16 }}>
            <strong>{student.name}</strong>
            {" — "}
            {interviewTarget.offer?.title || tc("deletedOffer")}
          </p>
          <ProposeInterviewForm
            application={interviewTarget}
            onCancel={() => setInterviewTarget(null)}
            onSubmitted={() => {
              setInterviewTarget(null);
              pushToast("success", td("toast.interviewProposed", { name: student.name }));
              silentRefresh();
            }}
            t={t}
          />
        </Modal>
      )}

      {documentsApi.preview && (
        <DocumentPreviewModal
          preview={documentsApi.preview}
          busy={documentsApi.busy}
          onClose={documentsApi.closePreview}
          onDownload={documentsApi.download}
        />
      )}

      <CndToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function AdminCandidateDossier() {
  const { t } = useTranslation();
  const { studentId } = useParams();
  return (
    <DashboardLayout title={t("adminCandidates.dossier.pageTitle")} subtitle={t("sidebar.admin.candidatures")}>
      <MotionConfig reducedMotion="user">
        {/* Remonté à chaque étudiant : aucun état (filtres, modales) ne fuit d'un dossier à l'autre. */}
        <DossierPage key={studentId} studentId={studentId} />
      </MotionConfig>
    </DashboardLayout>
  );
}
