import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiSend, FiBriefcase, FiFileText, FiUser, FiMic,
  FiBook, FiTrendingUp, FiSearch, FiAlertCircle,
  FiCheckCircle, FiInfo, FiBell, FiShield,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { aiService } from "../../services/ai.service.js";
import "./AIAssistant.css";

// Doit rester synchronisé avec MAX_USER_MESSAGES_PER_CONVERSATION côté serveur
// (thebridgeflow-back/controllers/ai.controller.js) — permet de désactiver l'envoi
// préventivement, avant même que le 41e message n'atteigne le backend.
const MAX_USER_MESSAGES = 40;

/* ── Robot 3D ──────────────────────────────────────────────────────────────── */
function Robot3D() {
  const containerRef = useRef(null);
  const [pupils, setPupils]   = useState({ x: 0, y: 0 });
  const [blink, setBlink]     = useState(false);
  const [hover, setHover]     = useState(false);
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    function onMove(e) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / window.innerWidth;
      const dy = (e.clientY - cy) / window.innerHeight;
      setPupils({ x: Math.max(-6, Math.min(6, dx * 12)), y: Math.max(-5, Math.min(5, dy * 10)) });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    function schedBlink() {
      const delay = 3000 + Math.random() * 5000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); schedBlink(); }, 160);
      }, delay);
    }
    const t = schedBlink();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTalking(true);
      setTimeout(() => setTalking(false), 800 + Math.random() * 800);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div ref={containerRef} className={`rb3d ${hover ? "rb3d--hover" : ""}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="rb3d__platform" />
      <div className="rb3d__float">
        <div className="rb3d__ant"><div className="rb3d__ant-ball" /></div>
        <div className="rb3d__head">
          <div className="rb3d__ear rb3d__ear--l" />
          <div className="rb3d__ear rb3d__ear--r" />
          <div className="rb3d__face">
            {[0, 1].map((i) => (
              <div key={i} className="rb3d__eye-wrap">
                <div className="rb3d__eye">
                  <div className="rb3d__pupil" style={{ transform: blink ? "scaleY(0.05)" : `translate(${pupils.x}px,${pupils.y}px)` }}>
                    <div className="rb3d__iris" />
                    <div className="rb3d__shine" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={`rb3d__mouth ${talking ? "rb3d__mouth--talk" : ""}`} />
          <div className="rb3d__cheek rb3d__cheek--l" />
          <div className="rb3d__cheek rb3d__cheek--r" />
        </div>
        <div className="rb3d__body">
          <div className="rb3d__neck" />
          <div className="rb3d__torso">
            <div className="rb3d__badge">S</div>
            <div className="rb3d__chest-light" />
          </div>
          <div className="rb3d__arm rb3d__arm--l" />
          <div className="rb3d__arm rb3d__arm--r" />
          <div className="rb3d__base" />
        </div>
      </div>
    </div>
  );
}

/* ── Message content (markdown minimaliste sans innerHTML) ─────────────────── */
function MessageContent({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];

  const parseInline = (str) => {
    const parts = str.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  lines.forEach((line, i) => {
    const isBullet = /^[\s]*[-•*]\s/.test(line);
    if (isBullet) {
      listItems.push(line.replace(/^[\s]*[-•*]\s/, ""));
    } else {
      if (listItems.length) {
        elements.push(
          <ul key={`ul-${i}`} className="ai-msg-list">
            {listItems.map((li, j) => <li key={j}>{parseInline(li)}</li>)}
          </ul>
        );
        listItems = [];
      }
      if (line.trim()) elements.push(<p key={i} className="ai-msg-p">{parseInline(line)}</p>);
    }
  });

  if (listItems.length) {
    elements.push(
      <ul key="ul-end" className="ai-msg-list">
        {listItems.map((li, j) => <li key={j}>{parseInline(li)}</li>)}
      </ul>
    );
  }

  return <>{elements}</>;
}

/* ── Insights sidebar (sans appel IA) ─────────────────────────────────────── */
function getInsights(ctx, t) {
  if (!ctx) return [];
  const insights = [];

  if (ctx.profileCompletion < 70)
    insights.push({ type: "warning", icon: <FiAlertCircle size={13}/>, text: t("aiAssistant.insightProfileIncomplete", { pct: ctx.profileCompletion }) });

  if (!ctx.user?.cv?.fileUrl)
    insights.push({ type: "action", icon: <FiFileText size={13}/>, text: t("aiAssistant.insightUploadCV") });

  if ((ctx.appStats?.["en attente"] || 0) > 0)
    insights.push({ type: "info", icon: <FiInfo size={13}/>, text: t("aiAssistant.insightPendingApps", { count: ctx.appStats["en attente"] }) });

  if ((ctx.appStats?.["acceptée"] || 0) > 0)
    insights.push({ type: "success", icon: <FiCheckCircle size={13}/>, text: t("aiAssistant.insightAcceptedApps", { count: ctx.appStats["acceptée"] }) });

  if (ctx.unreadCount > 0)
    insights.push({ type: "notif", icon: <FiBell size={13}/>, text: t("aiAssistant.insightUnreadNotifs", { count: ctx.unreadCount }) });

  if (ctx.applications?.length === 0)
    insights.push({ type: "action", icon: <FiSearch size={13}/>, text: t("aiAssistant.insightStartApplying") });

  return insights.slice(0, 4);
}

/* ── Actions selon le rôle ────────────────────────────────────────────────── */
function getActions(user, ctx, t) {
  const apps    = ctx?.applications?.length || 0;
  const pending = ctx?.appStats?.["en attente"] || 0;
  const specialty = user?.specialty || t("aiAssistant.defaultSpecialty");
  const university = user?.university || t("aiAssistant.defaultUniversity");
  const pct = ctx?.profileCompletion || 0;
  // Même logique que la page Entretiens (thebridgeflow-front/src/pages/interviews/Interviews.jsx) :
  // seuls les entretiens encore "proposé"/"confirmé" et non encore passés comptent
  // comme "à venir" — ctx.interviews contient tous les entretiens récents, pas
  // uniquement ceux à venir.
  const interviews = (ctx?.interviews || []).filter(
    (iv) => (iv.status === "proposé" || iv.status === "confirmé") && new Date(iv.scheduledAt) >= new Date()
  ).length;

  return [
    {
      ico: <FiBriefcase size={18}/>,
      label: t("aiAssistant.actionOffersLabel"),
      desc: t("aiAssistant.actionOffersDesc", { specialty }),
      prompt: t("aiAssistant.actionOffersPrompt", { specialty, university }),
    },
    {
      ico: <FiFileText size={18}/>,
      label: t("aiAssistant.actionAppsLabel"),
      desc: apps === 0 ? t("aiAssistant.actionAppsDescEmpty") : t("aiAssistant.actionAppsDesc", { count: apps, pending }),
      prompt: t("aiAssistant.actionAppsPrompt", { count: apps, pending }),
    },
    {
      ico: <FiUser size={18}/>,
      label: t("aiAssistant.actionProfileLabel"),
      desc: t("aiAssistant.actionProfileDesc", { pct }),
      prompt: t("aiAssistant.actionProfilePrompt", { pct }),
    },
    {
      ico: <FiMic size={18}/>,
      label: t("aiAssistant.actionInterviewLabel"),
      desc: interviews ? t("aiAssistant.actionInterviewDescCount", { count: interviews }) : t("aiAssistant.actionInterviewDescDefault"),
      prompt: t("aiAssistant.actionInterviewPrompt"),
    },
    {
      ico: <FiBook size={18}/>,
      label: t("aiAssistant.actionFormationsLabel"),
      desc: t("aiAssistant.actionFormationsDesc"),
      prompt: t("aiAssistant.actionFormationsPrompt", { specialty }),
    },
    {
      ico: <FiTrendingUp size={18}/>,
      label: t("aiAssistant.actionSkillsLabel"),
      desc: t("aiAssistant.actionSkillsDesc", { specialty }),
      prompt: t("aiAssistant.actionSkillsPrompt", { specialty }),
    },
  ];
}

/* ── Composant principal ──────────────────────────────────────────────────── */
export default function AIAssistant() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [ctx,        setCtx]        = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);

  const firstName = user?.name?.split(" ")[0] || t("aiAssistant.defaultFirstName");

  // Charger le contexte utilisateur pour la sidebar
  useEffect(() => {
    aiService.getUserContext()
      .then(({ data }) => setCtx(data))
      .catch(() => {})
      .finally(() => setCtxLoading(false));
  }, []);

  // Scroll chat au bas
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const limitReached = userMessageCount >= MAX_USER_MESSAGES;

  const sendMessage = useCallback(async (txt) => {
    const content = (txt ?? input).trim();
    if (!content || loading || limitReached) return;
    setInput("");
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const { data } = await aiService.chat(
        next.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages([...next, { role: "assistant", content: data.result?.text || "..." }]);
    } catch (err) {
      const errText = err.response?.data?.code === "AI_CONVERSATION_LIMIT_REACHED"
        ? t("aiAssistant.limitReached", { max: MAX_USER_MESSAGES })
        : t("aiAssistant.connectionError");
      setMessages([...next, { role: "assistant", content: errText }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, limitReached, messages, t]);

  const ACTIONS  = getActions(user, ctx, t);
  const INSIGHTS = getInsights(ctx, t);

  return (
    <DashboardLayout title={t("aiAssistant.pageTitle")} subtitle={t("aiAssistant.pageSubtitle")}>
      <div className="ai-page">

        {/* ── Layout principal ──────────────────────────────────────────── */}
        <div className="ai-layout">

          {/* ══ Colonne principale ══ */}
          <div className="ai-main">

            {/* Hero */}
            <div className="ai-hero">
              <div className="ai-hero__orb ai-hero__orb--1" />
              <div className="ai-hero__orb ai-hero__orb--2" />
              <div className="ai-hero__orb ai-hero__orb--3" />

              <div className="ai-hero__text">
                <p className="ai-hero__eyebrow">✦ {t("aiAssistant.eyebrow")}</p>
                <h2 className="ai-hero__title">
                  {t("aiAssistant.greeting")} <span className="ai-hero__name">{firstName}</span> !
                </h2>
                <p className="ai-hero__sub">
                  {t("aiAssistant.introLine1")}<br/>
                  {t("aiAssistant.introLine2")}
                </p>
                <div className="ai-hero__badges">
                  <span className="ai-hero__badge ai-hero__badge--live">
                    <span className="ai-hero__dot" />
                    {t("dashboard.student.online")}
                  </span>
                  {ctx && (
                    <span className="ai-hero__badge ai-hero__badge--role">
                      {user?.role ? t(`sidebar.roles.${user.role}`) : t("sidebar.roles.étudiant")}
                    </span>
                  )}
                  {ctx && (
                    <span className="ai-hero__badge ai-hero__badge--pct">
                      {t("aiAssistant.profileBadge", { pct: ctx.profileCompletion })}
                    </span>
                  )}
                </div>
              </div>

              <div className="ai-hero__robot">
                <Robot3D />
              </div>
            </div>

            {/* Action cards */}
            <p className="ai-section-label">{t("aiAssistant.actionsHeading")}</p>
            <div className="ai-actions-grid">
              {ACTIONS.map((a, i) => (
                <button key={i} className="ai-action-card" onClick={() => sendMessage(a.prompt)} disabled={limitReached}>
                  <div className="ai-action-card__ico">{a.ico}</div>
                  <div className="ai-action-card__label">{a.label}</div>
                  <div className="ai-action-card__desc">{a.desc}</div>
                </button>
              ))}
            </div>

            {/* Zone chat — toujours visible */}
            <div className="ai-chat-area">
              <div className="ai-chat-msgs" ref={chatRef}>
                {messages.length === 0 && (
                  <div className="ai-chat-empty">
                    <div className="ai-chat-empty__ico">✦</div>
                    <p>{t("aiAssistant.chatEmptyText")}</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ai-msg--${m.role}`}>
                    {m.role === "assistant" && (
                      <div className="ai-msg__av">✦</div>
                    )}
                    <div className="ai-msg__bubble">
                      <MessageContent text={m.content} />
                    </div>
                    {m.role === "user" && (
                      <div className="ai-msg__av ai-msg__av--user">
                        {user?.avatarUrl
                          ? <img src={user.avatarUrl} alt="" className="ai-msg__av-img"/>
                          : firstName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="ai-msg ai-msg--assistant">
                    <div className="ai-msg__av">✦</div>
                    <div className="ai-msg__bubble ai-msg__bubble--typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </div>

              {/* Bannière limite atteinte */}
              {limitReached && (
                <p className="ai-limit-banner">
                  <FiAlertCircle size={13} /> {t("aiAssistant.limitReachedBanner", { max: MAX_USER_MESSAGES })}
                </p>
              )}

              {/* Input bar */}
              <div className="ai-input-bar">
                <textarea
                  ref={inputRef}
                  className="ai-input-ta"
                  placeholder={t("aiAssistant.inputPlaceholder")}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  rows={1}
                  disabled={limitReached}
                />
                <button
                  className="ai-send-btn"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim() || limitReached}
                  title={t("aiAssistant.sendTitle")}
                >
                  <FiSend size={16} />
                </button>
              </div>
              <p className="ai-input-notice">
                <FiShield size={11} /> {t("aiAssistant.securityNotice")}
              </p>
            </div>

          </div>

          {/* ══ Sidebar droite ══ */}
          <aside className="ai-sidebar">

            {/* Profil card */}
            <div className="ai-scard">
              <div className="ai-scard__profile">
                <div className="ai-scard__avatar">
                  {user?.avatarUrl
                    ? <img src={user.avatarUrl} alt="" className="ai-scard__avatar-img"/>
                    : firstName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="ai-scard__name">{user?.name || "—"}</div>
                  <div className="ai-scard__role">{user?.role ? t(`sidebar.roles.${user.role}`) : "—"}</div>
                </div>
              </div>

              {/* Barre progression profil */}
              <div className="ai-scard__pct-row">
                <span className="ai-scard__pct-label">{t("aiAssistant.profileCompletedLabel")}</span>
                <span className="ai-scard__pct-val">{ctxLoading ? "—" : `${ctx?.profileCompletion ?? 0}%`}</span>
              </div>
              <div className="ai-progress">
                <div className="ai-progress__fill" style={{ width: ctxLoading ? "0%" : `${ctx?.profileCompletion ?? 0}%` }} />
              </div>

              {/* Stats rapides */}
              <div className="ai-scard__stats">
                <div className="ai-scard__stat">
                  <div className="ai-scard__stat-val">{ctxLoading ? "—" : ctx?.applications?.length ?? 0}</div>
                  <div className="ai-scard__stat-lbl">{t("dashboard.student.statsApplications")}</div>
                </div>
                <div className="ai-scard__stat">
                  <div className="ai-scard__stat-val">{ctxLoading ? "—" : ctx?.interviews?.length ?? 0}</div>
                  <div className="ai-scard__stat-lbl">{t("dashboard.student.statsInterviews")}</div>
                </div>
                <div className="ai-scard__stat">
                  <div className="ai-scard__stat-val">{ctxLoading ? "—" : ctx?.unreadCount ?? 0}</div>
                  <div className="ai-scard__stat-lbl">{t("sidebar.student.notifications")}</div>
                </div>
              </div>
            </div>

            {/* Insights IA */}
            {INSIGHTS.length > 0 && (
              <div className="ai-scard">
                <div className="ai-scard__title">{t("aiAssistant.insightsTitle")}</div>
                <div className="ai-insights">
                  {INSIGHTS.map((ins, i) => (
                    <div key={i} className={`ai-insight ai-insight--${ins.type}`}>
                      <span className="ai-insight__ico">{ins.icon}</span>
                      <span className="ai-insight__text">{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Favoris */}
            {(ctx?.favorites?.length > 0) && (
              <div className="ai-scard">
                <div className="ai-scard__title">{t("aiAssistant.favoritesTitle")}</div>
                <div className="ai-favorites">
                  {ctx.favorites.slice(0, 3).map((f, i) => (
                    <div key={i} className="ai-fav-item">
                      <div className="ai-fav-title">{f.title}</div>
                      <div className="ai-fav-company">{f.companyName || "—"}</div>
                    </div>
                  ))}
                  {ctx.favorites.length > 3 && (
                    <button className="ai-qlink" onClick={() => navigate("/dashboard/offers")}>
                      {t("aiAssistant.moreFavorites", { count: ctx.favorites.length - 3 })}
                    </button>
                  )}
                </div>
              </div>
            )}

          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
