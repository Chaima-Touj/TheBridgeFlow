import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Users, FileText } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import CandidatureStats from "./candidatures/CandidatureStats.jsx";
import StudentsView from "./candidatures/StudentsView.jsx";
import ApplicationsView from "./candidatures/ApplicationsView.jsx";
import { CndToastViewport } from "./candidatures/shared/CndToast.jsx";
import { useCndToast } from "./candidatures/shared/useCndToast.js";
import { ICON_SIZE, ICON_STROKE } from "./candidatures/candidatesConfig.js";
import "./candidatures/shared/candidatesShared.css";
import "./candidatures/CandidaturesList.css";

/* Page « Candidatures » (admin) — deux modes d'affichage :
   - Par étudiant (défaut) : un étudiant = une ligne, quel que soit le nombre
     de candidatures, avec accès à son dossier et à son suivi.
   - Par candidature : la vue historique, une ligne par candidature. */
const APPLICATION_STATUSES = ["all", "en attente", "en cours", "acceptée", "refusée"];

const VIEWS = [
  { key: "etudiants", Icon: Users, statKey: "totalStudents" },
  { key: "candidatures", Icon: FileText, statKey: "totalApplications" },
];

export default function AdminApplications() {
  const { t } = useTranslation();
  const tl = (key, options) => t(`adminCandidates.list.${key}`, options);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("vue") === "candidatures" ? "candidatures" : "etudiants";
  const [stats, setStats] = useState(null);
  const [statsKey, setStatsKey] = useState(0);
  const [studentsKey, setStudentsKey] = useState(0);
  const [applicationsKey, setApplicationsKey] = useState(0);
  const [scrollRequest, setScrollRequest] = useState(0);
  const listAnchorRef = useRef(null);
  const { toasts, pushToast, dismissToast } = useCndToast();
  const statusParam = searchParams.get("statut");
  const initialStatus = APPLICATION_STATUSES.includes(statusParam) ? statusParam : "en attente";

  const refreshStats = useCallback(() => setStatsKey((key) => key + 1), []);

  const switchView = (next) => {
    if (next === view) return;
    setSearchParams(next === "candidatures" ? { vue: "candidatures" } : {});
  };

  // Clic sur un indicateur : ouvre la vue et le filtre correspondants, puis
  // amène la liste à l'écran.
  const goToTarget = (target) => {
    if (target.view === "candidatures") {
      setSearchParams({ vue: "candidatures", statut: "all" });
      setApplicationsKey((key) => key + 1);
    } else {
      setSearchParams(target.filter && target.filter !== "all" ? { filtre: target.filter } : {});
      setStudentsKey((key) => key + 1);
    }
    setScrollRequest((value) => value + 1);
  };

  useEffect(() => {
    if (!scrollRequest) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      listAnchorRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest]);

  return (
    <DashboardLayout title={t("sidebar.admin.candidatures")} subtitle={t("adminCandidatures.pageSubtitle")}>
      <MotionConfig reducedMotion="user">
        <div className="cnd-scope cnd-list">
          <header className="cnd-list-head">
            <div className="cnd-list-head__text">
              <h1>{t("sidebar.admin.candidatures")}</h1>
              <p>{tl("pageDescription")}</p>
            </div>
            <div className="cnd-seg cnd-list-switch" role="group" aria-label={tl("viewSwitchLabel")}>
              {VIEWS.map(({ key, Icon, statKey }) => {
                const active = view === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="cnd-seg__btn"
                    aria-pressed={active}
                    onClick={() => switchView(key)}
                  >
                    {active && (
                      <motion.span
                        layoutId="cnd-list-view-pill"
                        className="cnd-seg__indicator"
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      />
                    )}
                    <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    <span>{tl(`views.${key}`)}</span>
                    {typeof stats?.[statKey] === "number" && (
                      <span className="cnd-list-switch__count cnd-num">{stats[statKey]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </header>

          <CandidatureStats
            refreshKey={statsKey}
            onStats={setStats}
            onSelect={goToTarget}
            current={view === "etudiants" ? { view, filter: searchParams.get("filtre") || "all" } : { view }}
          />

          <div ref={listAnchorRef} className="cnd-list-anchor">
          <AnimatePresence mode="wait" initial={false}>
            <motion.section
              key={view}
              className="cnd-list-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.22, 0.8, 0.24, 1] }}
              aria-label={tl(`views.${view}`)}
            >
              {view === "etudiants" ? (
                <StudentsView
                  key={studentsKey}
                  searchParams={searchParams}
                  setSearchParams={setSearchParams}
                />
              ) : (
                <ApplicationsView
                  key={applicationsKey}
                  initialStatus={initialStatus}
                  onDataChanged={refreshStats}
                  pushToast={pushToast}
                />
              )}
            </motion.section>
          </AnimatePresence>
          </div>
        </div>
        <CndToastViewport toasts={toasts} onDismiss={dismissToast} />
      </MotionConfig>
    </DashboardLayout>
  );
}
