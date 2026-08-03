import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import {
  FiBell, FiFileText, FiClock, FiCheckCircle, FiArrowRight, FiMapPin,
  FiBriefcase, FiCalendar, FiSend, FiX, FiActivity,
  FiAlertCircle, FiUser, FiChevronRight, FiTarget, FiClipboard,
  FiCpu, FiLock, FiTrendingUp,
} from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { offersService } from "../../services/offers.service.js";
import { aiService } from "../../services/ai.service.js";
import api from "../../services/api.js";
import { computeCompletion } from "../../utils/profileUtils";
import "./StudentDashboard.css";

/* ─── Constants ───────────────────────────────────────────────────────────── */
const COLORS = ["#F59E0B", "#2563EB", "#8B5CF6", "#10B981", "#EF4444"];

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

const AVATAR_COLORS = [
  "#4F46E5","#10B981","#F59E0B","#EF4444","#8B5CF6","#0EA5E9","#EC4899",
];

const NOTIF_COLORS = {
  success: "#10B981",
  warning: "#F59E0B",
  error:   "#EF4444",
  info:    "#2563EB",
};

const REQUEST_STATUS = {
  en_attente: { labelKey: "mesDemandes.statusPending",  color: "#F59E0B" },
  acceptée:   { labelKey: "mesDemandes.statusAccepted", color: "#10B981" },
  refusée:    { labelKey: "mesDemandes.statusRejected", color: "#EF4444" },
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function getIconEntry(slug = "") {
  return ICON_MAP[slug] ?? [{ Comp: SiReact, color: "#61DAFB" }];
}

function normalizeOffer(o, fallbackCompany) {
  return {
    ...o,
    companyName: o.companyName || o.company || fallbackCompany,
    skills: (o.skills?.length ? o.skills : o.motsCles) || [],
    location: o.location || "",
  };
}


function timeAgo(dateStr, t) {
  if (!dateStr) return t("dashboard.student.recent");
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return t("dashboard.student.today");
  if (days === 1) return t("dashboard.student.yesterday");
  return t("dashboard.student.daysAgo", { count: days });
}

function getGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t("dashboard.student.goodMorning");
  if (h < 18) return t("dashboard.student.goodAfternoon");
  return t("dashboard.student.goodEvening");
}

function getAvatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ─── Robot animé ─────────────────────────────────────────────────────────── */
function AnimatedRobot({ size = 80 }) {
  return (
    <div className="ai-robot" style={{ width: size, height: size }}>
      <div className="ai-robot__body">
        <div className="ai-robot__head">
          <div className="ai-robot__eye ai-robot__eye--left" />
          <div className="ai-robot__eye ai-robot__eye--right" />
          <div className="ai-robot__mouth" />
          <div className="ai-robot__antenna" />
        </div>
        <div className="ai-robot__torso">
          <div className="ai-robot__screen">
            <div className="ai-robot__screen-dot" />
            <div className="ai-robot__screen-dot" />
          </div>
        </div>
        <div className="ai-robot__arms">
          <div className="ai-robot__arm ai-robot__arm--left" />
          <div className="ai-robot__arm ai-robot__arm--right" />
        </div>
      </div>
      <div className="ai-robot__glow" />
    </div>
  );
}

/* ─── Chatbot IA ──────────────────────────────────────────────────────────── */
function AIChatbot({ user }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: t("dashboard.student.aiWidget.greeting", { name: user?.name?.split(" ")[0] || "" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");
    setRecs(null);
    const newMessages = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setLoading(true);
    try {
      if (
        content.toLowerCase().includes("recommand") ||
        content.toLowerCase().includes("stage")
      ) {
        const { data } = await api.post("/ai/recommendations", { limit: 3 });
        setRecs(data.offers?.slice(0, 3) || []);
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.analysis || t("dashboard.student.aiWidget.recsFallback"),
          },
        ]);
        return;
      }
      const { data } = await aiService.chat(
        newMessages.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.result?.text || t("dashboard.student.aiWidget.chatFallback"),
        },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: t("dashboard.student.aiWidget.connectionError"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: t("dashboard.student.aiWidget.quickRecommendationsLabel"), text: t("dashboard.student.aiWidget.quickRecommendationsText") },
    { label: t("dashboard.student.aiWidget.quickCvLabel"),              text: t("dashboard.student.aiWidget.quickCvText") },
    { label: t("dashboard.student.aiWidget.quickLetterLabel"),          text: t("dashboard.student.aiWidget.quickLetterText") },
    { label: t("dashboard.student.aiWidget.quickInterviewLabel"),       text: t("dashboard.student.aiWidget.quickInterviewText") },
  ];

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} title={t("dashboard.student.aiWidget.fabTitle")}>
          <AnimatedRobot size={44} />
          <span className="ai-fab__badge">IA</span>
        </button>
      )}

      {open && (
        <div className="ai-panel">
          <div className="ai-panel__header">
            <div className="ai-panel__header-left">
              <AnimatedRobot size={52} />
              <div>
                <div className="ai-panel__name">{t("dashboard.student.aiWidget.panelName")} ✨</div>
                <div className="ai-panel__status">
                  <span className="ai-panel__dot" /> {t("dashboard.student.online")}
                </div>
              </div>
            </div>
            <button className="ai-panel__close" onClick={() => setOpen(false)}>
              <FiX size={18} />
            </button>
          </div>

          <div className="ai-panel__messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg--${m.role}`}>
                {m.role === "assistant" && <div className="ai-msg__bot-icon">🤖</div>}
                <div className="ai-msg__bubble">
                  {m.content.split("\n").map((line, j) => (
                    <p key={j} style={{ margin: "0 0 2px" }}>{line}</p>
                  ))}
                </div>
              </div>
            ))}

            {recs && recs.length > 0 && (
              <div className="ai-recs">
                {recs.map((offer) => (
                  <Link
                    key={offer._id}
                    to={`/dashboard/student/offers/${offer._id}`}
                    className="ai-rec-card"
                    onClick={() => setRecs(null)}
                  >
                    <div className="ai-rec-logo">
                      {offer.companyName?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="ai-rec-info">
                      <div className="ai-rec-title">{offer.title}</div>
                      <div className="ai-rec-company">{offer.companyName}</div>
                      {offer.location && (
                        <div className="ai-rec-loc">
                          <FiMapPin size={10} /> {offer.location}
                        </div>
                      )}
                    </div>
                    <FiArrowRight size={13} style={{ color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
            )}

            {loading && (
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-msg__bot-icon">🤖</div>
                <div className="ai-msg__bubble ai-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="ai-quick-actions">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  className="ai-quick-btn"
                  onClick={() => sendMessage(a.text)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {messages.length > 1 && (
            <div className="ai-suggestion-bar">
              <div className="ai-suggestion-robot">
                <AnimatedRobot size={36} />
              </div>
              <p className="ai-suggestion-text">
                💡 {t("dashboard.student.aiWidget.suggestionText")}
              </p>
            </div>
          )}

          <div className="ai-panel__footer">
            <input
              className="ai-panel__input"
              placeholder={t("dashboard.student.aiWidget.inputPlaceholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading}
            />
            <button
              className="ai-panel__send"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              <FiSend size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
export default function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [offers,        setOffers]        = useState([]);
  const [requests,      setRequests]      = useState([]);
  const [applications,  setApplications]  = useState([]);
  const [interviews,    setInterviews]    = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      offersService.getAll({ limit: 3 }),
      api.get("/applications"),
      api.get("/interviews"),
      api.get("/notifications"),
      api.get("/enrollment-requests"),
    ])
      .then(([offersRes, appsRes, intRes, notifRes, reqRes]) => {
        setOffers(
          (offersRes.data.offers || [])
            .filter((o) => o.type !== "formation")
            .slice(0, 3)
            .map((o) => normalizeOffer(o, t("dashboard.student.unknownCompany")))
        );
        setApplications(appsRes.data.applications || []);
        setInterviews(
          (intRes.data.interviews || []).sort(
            (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)
          )
        );
        setNotifications(notifRes.data.notifications || []);
        setRequests((reqRes.data || []).slice(0, 4));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ─── Computed values ────────────────────────────────────────────────── */
  const counts = {
    total:      applications.length,
    enAttente:  applications.filter((a) => a.status === "en attente").length,
    enCours:    applications.filter((a) => a.status === "en cours").length,
    acceptee:   applications.filter((a) => a.status === "acceptée").length,
    refusee:    applications.filter((a) => a.status === "refusée").length,
    entretiens: interviews.filter(
      (iv) => iv.status !== "annulé" && iv.status !== "terminé"
    ).length,
  };

  // Uniquement les statuts de candidature : counts.entretiens est une autre
  // dimension (une candidature "en cours" peut avoir 0, 1 ou plusieurs
  // entretiens), l'additionner ici faisait dépasser 100% sur le donut — les
  // entretiens ont leur propre carte juste à côté.
  const pieData = [
    { name: t("status.en attente"),                 value: counts.enAttente  },
    { name: t("dashboard.student.statsInProgress"), value: counts.enCours    },
    { name: t("status.acceptée"),                   value: counts.acceptee   },
    { name: t("status.refusée"),                    value: counts.refusee    },
  ].filter((d) => d.value > 0);

  const upcomingInterviews = interviews
    .filter(
      (iv) =>
        iv.status !== "annulé" &&
        iv.status !== "terminé" &&
        new Date(iv.scheduledAt) >= new Date()
    )
    .slice(0, 3);

  const imminentInterview = upcomingInterviews.find((iv) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = new Date(iv.scheduledAt) - Date.now();
    return diff > 0 && diff < 48 * 3600 * 1000;
  });

  const recentActivity = [
    ...applications.slice(0, 3).map((a) => ({
      color: "#2563EB",
      text:  `${t("dashboard.student.applicationSent")} — ${a.offerId?.companyName || ""}`,
      time:  timeAgo(a.createdAt, t),
    })),
    ...notifications.slice(0, 2).map((n) => ({
      color: NOTIF_COLORS[n.type] || NOTIF_COLORS.info,
      text:  n.message,
      time:  timeAgo(n.createdAt, t),
    })),
  ].slice(0, 5);

  const completionPct = computeCompletion(user);
  const firstName     = user?.name?.split(" ")[0] || "Étudiant";
  const avatarColor   = getAvatarColor(user?.name || "");
  const greeting      = getGreeting(t);

  const successRate  = counts.total > 0
    ? Math.round((counts.acceptee / counts.total) * 100) : 0;
  const responseRate = counts.total > 0
    ? Math.round(((counts.acceptee + counts.refusee) / counts.total) * 100) : 0;

  const stats = [
    {
      label: t("dashboard.student.statsApplications"),
      desc:  t("dashboard.student.statsTotalSent"),
      value: counts.total,
      color: "#2563EB",
      icon:  <FiBriefcase size={20} />,
    },
    {
      label: t("dashboard.student.statsPending"),
      desc:  t("dashboard.student.statsPendingDesc"),
      value: counts.enAttente,
      color: "#F59E0B",
      icon:  <FiClock size={20} />,
    },
    {
      label: t("dashboard.student.statsInterviews"),
      desc:  t("dashboard.student.statsInterviewsDesc"),
      value: counts.entretiens,
      color: "#8B5CF6",
      icon:  <FiCalendar size={20} />,
    },
    {
      label: t("dashboard.student.statsAccepted"),
      desc:  t("dashboard.student.statsAcceptedDesc"),
      value: counts.acceptee,
      color: "#10B981",
      icon:  <FiCheckCircle size={20} />,
    },
  ];

  return (
    <DashboardLayout
      title={t("dashboard.student.greeting", { name: firstName })}
      subtitle={t("dashboard.student.subtitle")}
    >
      <div className="sd-root">

        {/* ── 1. Hero ────────────────────────────────────────────────────── */}
        <div className="sd-hero">
          <div className="sd-hero__decoration" aria-hidden="true"/>
          <div className="sd-hero__avatar" style={{ background: avatarColor }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="sd-hero__avatar-img"/>
              : firstName[0]?.toUpperCase()}
          </div>
          <div className="sd-hero__body">
            <p className="sd-hero__greeting">{greeting} 👋</p>
            <h1 className="sd-hero__name">{user?.name || firstName}</h1>
            <div className="sd-hero__meta">
              {user?.specialty && <span>{user.specialty}</span>}
              {user?.university && <span>{user.university}</span>}
            </div>
          </div>
          <div className="sd-hero__chips">
            <div className="sd-hero__chip">
              <span className="sd-hero__chip-val">{loading ? "—" : counts.total}</span>
              <span className="sd-hero__chip-lbl">{t("dashboard.student.statsApplications")}</span>
            </div>
            <div className="sd-hero__chip">
              <span className="sd-hero__chip-val">{loading ? "—" : counts.entretiens}</span>
              <span className="sd-hero__chip-lbl">{t("dashboard.student.statsInterviews")}</span>
            </div>
            <div className="sd-hero__chip">
              <span className="sd-hero__chip-val">
                {loading ? "—" : notifications.filter((n) => !n.isRead).length}
              </span>
              <span className="sd-hero__chip-lbl">{t("sidebar.student.notifications")}</span>
            </div>
          </div>
        </div>

        {/* ── 2. Profile completion banner ────────────────────────────────── */}
        {completionPct < 100 && (
          <div className="sd-completion">
            <div className="sd-completion__left">
              <div className="sd-completion__icon"><FiUser size={18} /></div>
              <div>
                <div className="sd-completion__label">
                  {t("dashboard.student.profileCompletion")} — {completionPct}%
                </div>
                <div className="sd-completion__bar-wrap">
                  <div className="sd-completion__bar">
                    <div
                      className="sd-completion__fill"
                      style={{
                        width: `${completionPct}%`,
                        background:
                          completionPct >= 60 ? "#10B981"
                          : completionPct >= 30 ? "#F59E0B"
                          : "#EF4444",
                      }}
                    />
                  </div>
                  <span className="sd-completion__pct">{completionPct}%</span>
                </div>
              </div>
            </div>
            <Link to="/dashboard/student/profile" className="sd-completion__cta">
              {t("dashboard.student.profileCompleteAction")}
              <FiChevronRight size={14} />
            </Link>
          </div>
        )}

        {/* ── 3. Imminent interview alert ──────────────────────────────────── */}
        {imminentInterview && (
          <div className="sd-imminent">
            <FiAlertCircle size={18} />
            <span>
              <strong>{t("dashboard.student.imminentAlert")} :</strong>{" "}
              {imminentInterview.applicationId?.offerId?.title || t("dashboard.student.interviewFallback")} —{" "}
              {new Date(imminentInterview.scheduledAt).toLocaleString("fr-FR", {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* ── 4. Stats ────────────────────────────────────────────────────── */}
        <div className="sd-stats">
          {stats.map((s, i) => (
            <div key={i} className="sd-stat-card">
              <div className="sd-stat-top">
                <div className="sd-stat-icon" style={{ background: s.color + "18", color: s.color }}>
                  {s.icon}
                </div>
                <div className="sd-stat-dot" style={{ background: s.color }}/>
              </div>
              <div className="sd-stat-value">{loading ? "—" : s.value}</div>
              <div className="sd-stat-label">{s.label}</div>
              <div className="sd-stat-sub">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* ── 5. Suivi candidatures | Entretiens ──────────────────────────── */}
        <div className="sd-split-grid">

          {/* Donut */}
          <div className="sd-card">
            <h2 className="sd-card-title" style={{ marginBottom: "1.25rem" }}>
              {t("dashboard.student.applicationTracking")}
            </h2>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 180 }}/>
            ) : pieData.length === 0 ? (
              <div className="sd-empty-box">
                <FiFileText size={28} style={{ opacity: .3 }}/>
                <p>{t("dashboard.student.noApplications")}</p>
                <Link to="/dashboard/student/offers" className="sd-btn-primary">
                  {t("dashboard.student.browseOffers")}
                </Link>
              </div>
            ) : (
              <div className="sd-pie-row">
                <ResponsiveContainer width="48%" height={170}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="sd-pie-legend">
                  {pieData.map((d, i) => (
                    <div key={i} className="sd-pie-item">
                      <span className="sd-pie-dot" style={{ background: COLORS[i] }}/>
                      <span className="sd-pie-name">{d.name}</span>
                      <strong>{d.value}</strong>
                      <span className="sd-pie-pct" style={{ color: COLORS[i] }}>
                        ({counts.total > 0 ? Math.round((d.value / counts.total) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Entretiens */}
          <div className="sd-card">
            <div className="sd-card-header" style={{ marginBottom: "1rem" }}>
              <h2 className="sd-card-title">{t("dashboard.student.upcomingInterviews")}</h2>
              {upcomingInterviews.length > 0 && (
                <Link to="/dashboard/student/interviews" className="sd-link-more">
                  {t("dashboard.student.viewAllInterviews")} <FiArrowRight size={13}/>
                </Link>
              )}
            </div>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 180 }}/>
            ) : upcomingInterviews.length === 0 ? (
              <div className="sd-empty-box">
                <FiCalendar size={28} style={{ opacity: .3 }}/>
                <p>{t("dashboard.student.noInterviews")}</p>
              </div>
            ) : (
              upcomingInterviews.map((iv) => (
                <div key={iv._id} className="sd-iv-item">
                  <div className="sd-iv-icon"><FiCalendar size={15}/></div>
                  <div className="sd-iv-info">
                    <div className="sd-iv-title">
                      {iv.applicationId?.offerId?.title || t("dashboard.student.interviewFallback")}
                    </div>
                    <div className="sd-iv-company">
                      {iv.companyId?.name || iv.applicationId?.offerId?.companyName || ""}
                    </div>
                    <div className="sd-iv-date">
                      {new Date(iv.scheduledAt).toLocaleString("fr-FR", {
                        weekday: "short", day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <span className={`sd-mode-badge ${iv.mode === "présentiel" ? "sd-mode--pres" : "sd-mode--online"}`}>
                    {iv.mode === "présentiel"
                      ? t("dashboard.student.onsite")
                      : t("dashboard.student.online")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── 6. Offres recommandées ───────────────────────────────────────── */}
        <div className="sd-card">
          <div className="sd-card-header">
            <h2 className="sd-card-title">{t("dashboard.student.recommendedOffers")}</h2>
            <Link to="/dashboard/student/offers" className="sd-link-more">
              {t("dashboard.student.viewAll")} <FiArrowRight size={13}/>
            </Link>
          </div>
          <div className="sd-offers-grid">
            {loading
              ? [1, 2, 3].map((i) => <div key={i} className="sd-skeleton" style={{ height: 180 }}/>)
              : offers.length === 0
              ? <p className="sd-empty">{t("dashboard.student.noOffers")}</p>
              : offers.map((o) => (
                <Link
                  key={o._id}
                  to={`/dashboard/student/offers/${o._id}`}
                  className="sd-offer-card"
                >
                  <div className="sd-offer-top">
                    <div className="sd-offer-logo">
                      {o.companyName?.[0]?.toUpperCase() || "?"}
                    </div>
                    {o.type && <span className="sd-offer-type">{o.type}</span>}
                  </div>
                  <div className="sd-offer-title">{o.title}</div>
                  <div className="sd-offer-company">{o.companyName}</div>
                  {o.location && (
                    <div className="sd-offer-loc">
                      <FiMapPin size={11}/> {o.location}
                    </div>
                  )}
                  <div className="sd-offer-skills">
                    {o.skills.slice(0, 3).map((s) => (
                      <span key={s} className="sd-badge">{s}</span>
                    ))}
                  </div>
                  <div className="sd-offer-footer">
                    <span className="sd-offer-time">{timeAgo(o.createdAt, t)}</span>
                    <span className="sd-offer-cta">
                      {t("offers.viewDetails")} <FiArrowRight size={11}/>
                    </span>
                  </div>
                </Link>
              ))
            }
          </div>
        </div>

        {/* ── 7. Activité | Notifications ────────────────────────────────── */}
        <div className="sd-split-grid">

          {/* Activité récente */}
          <div className="sd-card">
            <div className="sd-card-header">
              <h2 className="sd-card-title">{t("dashboard.student.recentActivity")}</h2>
              <Link to="/dashboard/student/applications" className="sd-link-more">
                {t("dashboard.student.viewAllApplications")} <FiArrowRight size={13}/>
              </Link>
            </div>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 160 }}/>
            ) : recentActivity.length === 0 ? (
              <div className="sd-empty-box">
                <FiActivity size={28} style={{ opacity: .3 }}/>
                <p>{t("dashboard.student.noActivity")}</p>
              </div>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="sd-act-item">
                  <div className="sd-act-icon" style={{ background: a.color + "18", color: a.color }}>
                    <FiActivity size={13}/>
                  </div>
                  <div className="sd-act-body">
                    <div className="sd-act-text">{a.text}</div>
                    <div className="sd-act-time">{a.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Notifications récentes */}
          <div className="sd-card">
            <div className="sd-card-header">
              <h2 className="sd-card-title">{t("dashboard.student.recentNotifications")}</h2>
              <Link to="/dashboard/student/notifications" className="sd-link-more">
                {t("dashboard.student.viewAllNotifications")} <FiArrowRight size={13}/>
              </Link>
            </div>
            {loading ? (
              <div className="sd-skeleton" style={{ height: 160 }}/>
            ) : notifications.length === 0 ? (
              <div className="sd-empty-box">
                <FiBell size={28} style={{ opacity: .3 }}/>
                <p>{t("dashboard.student.noNotifications")}</p>
              </div>
            ) : (
              notifications.slice(0, 4).map((n) => {
                const color = NOTIF_COLORS[n.type] || NOTIF_COLORS.info;
                return (
                  <div key={n._id} className={`sd-notif-item ${!n.isRead ? "sd-notif-item--unread" : ""}`}>
                    <div className="sd-notif-icon" style={{ background: color + "18", color }}>
                      <FiBell size={13}/>
                    </div>
                    <div className="sd-notif-body">
                      <div className="sd-notif-title">{n.title}</div>
                      <div className="sd-notif-time">{timeAgo(n.createdAt, t)}</div>
                    </div>
                    {!n.isRead && <div className="sd-notif-dot"/>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 8. Mes demandes ─────────────────────────────────────────────── */}
        <div className="sd-card">
          <div className="sd-card-header">
            <h2 className="sd-card-title">{t("mesDemandes.heading")}</h2>
            <Link to="/dashboard/student/demandes" className="sd-link-more">
              {t("dashboard.student.viewAll")} <FiArrowRight size={13}/>
            </Link>
          </div>
          {loading ? (
            <div className="sd-skeleton" style={{ height: 160 }}/>
          ) : requests.length === 0 ? (
            <div className="sd-empty-box">
              <FiClipboard size={28} style={{ opacity: .3 }}/>
              <p>{t("mesDemandes.emptyTitle")}</p>
              <Link to="/dashboard/student/formations" className="sd-btn-primary">
                {t("mesDemandes.browseCta")}
              </Link>
            </div>
          ) : (
            <div className="sd-req-list">
              {requests.map((req) => {
                const formation = req.formation || {};
                const icons = getIconEntry(formation.slug || "");
                const status = REQUEST_STATUS[req.status] || REQUEST_STATUS.en_attente;
                const locale = i18n.language === "ar" ? "ar-TN" : i18n.language === "en" ? "en-US" : "fr-FR";
                return (
                  <div key={req._id} className="sd-req-item">
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      {icons.map(({ Comp: Ic, color: c }, i) => (
                        <div
                          key={i}
                          className="sd-req-icon"
                          style={{
                            background: `${c}18`,
                            color: c,
                            ...(icons.length >= 2 && { width: 28, height: 28 }),
                            ...(icons.length >= 3 && { width: 22, height: 22 }),
                          }}
                        >
                          <Ic size={icons.length >= 3 ? 10 : icons.length >= 2 ? 12 : 15}/>
                        </div>
                      ))}
                    </div>
                    <div className="sd-req-info">
                      <div className="sd-req-title">{formation.title || t("dashboardFormations.title")}</div>
                      <div className="sd-req-meta">
                        {req.mode} · {new Date(req.createdAt).toLocaleDateString(locale)}
                      </div>
                    </div>
                    <span
                      className="sd-req-badge"
                      style={{ background: `${status.color}15`, color: status.color }}
                    >
                      {t(status.labelKey)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 9. Objectifs & Progression ──────────────────────────────────── */}
        <div className="sd-card">
          <div className="sd-card-header" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: ".625rem" }}>
              <div className="sd-goals-ico"><FiTarget size={16}/></div>
              <h2 className="sd-card-title">{t("dashboard.student.goals")}</h2>
            </div>
            <Link to="/dashboard/student/profile" className="sd-link-more">
              {t("dashboard.student.profileCompleteAction")} <FiChevronRight size={13}/>
            </Link>
          </div>
          <div className="sd-goals-grid">

            {/* Profile */}
            <div className="sd-goal-item">
              <div className="sd-goal-top">
                <span className="sd-goal-label">{t("dashboard.student.profileGoal")}</span>
                <span className="sd-goal-pct" style={{
                  color: completionPct >= 80 ? "#10B981" : completionPct >= 50 ? "#F59E0B" : "#EF4444"
                }}>
                  {completionPct}%
                </span>
              </div>
              <div className="sd-goal-bar">
                <div
                  className="sd-goal-fill"
                  style={{
                    width: `${completionPct}%`,
                    background: completionPct >= 80 ? "linear-gradient(90deg,#10B981,#059669)"
                      : completionPct >= 50 ? "linear-gradient(90deg,#F59E0B,#D97706)"
                      : "linear-gradient(90deg,#EF4444,#DC2626)",
                  }}
                />
              </div>
              <p className="sd-goal-desc">{completionPct < 100 ? t("dashboard.student.profileCompleteAction") : "✓ Complet"}</p>
            </div>

            {/* Success rate */}
            <div className="sd-goal-item">
              <div className="sd-goal-top">
                <span className="sd-goal-label">{t("dashboard.student.successGoal")}</span>
                <span className="sd-goal-pct" style={{ color: "#10B981" }}>
                  {successRate}%
                </span>
              </div>
              <div className="sd-goal-bar">
                <div
                  className="sd-goal-fill"
                  style={{
                    width: `${successRate}%`,
                    background: "linear-gradient(90deg,#10B981,#059669)",
                  }}
                />
              </div>
              <p className="sd-goal-desc">
                {counts.acceptee} / {counts.total} {t("dashboard.student.statsApplications").toLowerCase()}
              </p>
            </div>

            {/* Response rate */}
            <div className="sd-goal-item">
              <div className="sd-goal-top">
                <span className="sd-goal-label">{t("dashboard.student.responseGoal")}</span>
                <span className="sd-goal-pct" style={{ color: "var(--primary)" }}>
                  {responseRate}%
                </span>
              </div>
              <div className="sd-goal-bar">
                <div
                  className="sd-goal-fill"
                  style={{
                    width: `${responseRate}%`,
                    background: "linear-gradient(90deg, var(--primary), #7C3AED)",
                  }}
                />
              </div>
              <p className="sd-goal-desc">
                {counts.acceptee + counts.refusee} réponses reçues sur {counts.total}
              </p>
            </div>

          </div>
        </div>

      </div>

      <AIChatbot user={user} />
    </DashboardLayout>
  );
}
