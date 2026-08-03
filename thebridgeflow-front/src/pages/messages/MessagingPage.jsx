// src/pages/messages/MessagingPage.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiMessageSquare, FiSearch, FiX, FiSend, FiChevronLeft,
  FiUser, FiUsers, FiShield,
  FiFileText, FiPaperclip, FiSmile, FiUserPlus, FiDownload,
} from "react-icons/fi";
import DashboardLayout    from "../../components/layout/DashboardLayout.jsx";
import { useAuth }        from "../../context/AuthContext.jsx";
import { messagesService } from "../../services/messages.service.js";
import "./MessagingPage.css";

/* ── Constantes ───────────────────────────────────────── */
const UPLOADS_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

/* ── Emoji list ───────────────────────────────────────── */
const EMOJIS = [
  "😊","😀","😂","🥹","😍","🤩","😎","🙏",
  "👍","👏","❤️","🔥","✨","🎉","💪","🚀",
  "😅","😬","🤔","😏","😒","😢","😭","😤",
  "👋","✌️","🤝","💼","📝","📌","💡","⭐",
  "✅","❌","⚠️","📊","📈","🎯","🔑","💬",
];

/* ── Helpers ──────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return "À l'instant";
  if (mins  < 60)  return `${mins} min`;
  if (hours < 24)  return `${hours}h`;
  if (days  === 1) return "Hier";
  if (days  < 7)   return `${days}j`;
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatGroupDate(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (+msgDay === +today)     return "today";
  if (+msgDay === +yesterday) return "yesterday";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function groupMessagesByDate(messages) {
  const groups = [];
  let currentKey = null;
  for (const msg of messages) {
    const key = formatGroupDate(msg.createdAt);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ key, messages: [] });
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

function avatarColor(name = "") {
  const palette = ["#4F46E5","#10B981","#F59E0B","#EF4444","#8B5CF6","#0EA5E9","#EC4899","#14B8A6"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Role icon ────────────────────────────────────────── */
function RoleIcon({ role, size = 14 }) {
  if (role === "admin") return <FiShield size={size} />;
  return <FiUser size={size} />;
}

function roleKey(role) {
  if (role === "admin") return "roleAdmin";
  return "roleEtudiant";
}

/* ── Skeleton ─────────────────────────────────────────── */
function SkeletonConvItem() {
  return (
    <div className="msg-conv-item msg-conv-item--skel">
      <div className="msg-skel msg-skel-avatar" />
      <div className="msg-conv-body">
        <div className="msg-skel" style={{ height: 14, width: "55%", marginBottom: 6 }} />
        <div className="msg-skel" style={{ height: 12, width: "80%" }} />
      </div>
    </div>
  );
}

function SkeletonBubble({ mine }) {
  return (
    <div className={`msg-bubble-row${mine ? " msg-bubble-row--mine" : ""}`}>
      <div className="msg-skel" style={{ height: 38, width: mine ? "55%" : "50%", borderRadius: 12 }} />
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────── */
function StatCard({ value, label, icon: Icon, color }) {
  return (
    <div className="msg-stat">
      <div className="msg-stat-icon" style={{ background: `${color}18`, color }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="msg-stat-value">{value}</div>
        <div className="msg-stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ── Conversation item ────────────────────────────────── */
function ConvItem({ conv, isActive, myId, onClick, t }) {
  const { otherUser, lastMessage, unreadCount } = conv;
  const isMine = lastMessage
    ? String(lastMessage.senderId?._id ?? lastMessage.senderId) === String(myId)
    : false;
  const rawPreview = lastMessage
    ? (lastMessage.content || (lastMessage.fileName ? `📎 ${lastMessage.fileName}` : "📎 Fichier"))
    : "";
  const preview = lastMessage
    ? isMine ? `${t("messages.you")}: ${rawPreview}` : rawPreview
    : t("messages.noConversations");

  return (
    <button
      type="button"
      className={`msg-conv-item${isActive ? " msg-conv-item--active" : ""}${unreadCount > 0 ? " msg-conv-item--unread" : ""}`}
      onClick={onClick}
      aria-label={otherUser?.name}
    >
      <div className="msg-avatar" style={{ background: avatarColor(otherUser?.name || "") }}>
        {otherUser?.avatarUrl
          ? <img src={otherUser.avatarUrl} alt="" className="msg-avatar__img"/>
          : (otherUser?.name?.[0]?.toUpperCase() || "?")}
        <span className="msg-avatar-online" />
      </div>
      <div className="msg-conv-body">
        <div className="msg-conv-header">
          <span className="msg-conv-name">{otherUser?.name || "—"}</span>
          <span className="msg-conv-time">{timeAgo(conv.lastMessageAt)}</span>
        </div>
        <div className="msg-conv-footer">
          <span className="msg-conv-preview">{preview}</span>
          {unreadCount > 0 && (
            <span className="msg-conv-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Student item ─────────────────────────────────────── */
function StudentItem({ student, isActive, hasConv, onClick, t }) {
  return (
    <button
      type="button"
      className={`msg-student-item${isActive ? " msg-student-item--active" : ""}`}
      onClick={onClick}
      aria-label={student.name}
    >
      <div className="msg-avatar" style={{ background: avatarColor(student.name || "") }}>
        {student.avatarUrl
          ? <img src={student.avatarUrl} alt="" className="msg-avatar__img"/>
          : (student.name?.[0]?.toUpperCase() || "?")}
      </div>
      <div className="msg-student-body">
        <div className="msg-student-name">
          {student.name}
          {hasConv && <span className="msg-student-conv-dot" title={t("messages.existingConversation")} />}
        </div>
        {(student.specialty || student.university) && (
          <div className="msg-student-meta">
            {[student.specialty, student.university].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </button>
  );
}

/* ── Message bubble ───────────────────────────────────── */
function MessageBubble({ msg, myId, t }) {
  const isMine  = String(msg.senderId._id ?? msg.senderId) === String(myId);
  const hasFile = Boolean(msg.fileUrl);
  const isImage = msg.fileType?.startsWith("image/");
  const fileHref = hasFile ? UPLOADS_BASE + msg.fileUrl : null;

  return (
    <div className={`msg-bubble-row${isMine ? " msg-bubble-row--mine" : ""}`}>
      <div className={`msg-bubble${isMine ? " msg-bubble--mine" : ""}${hasFile ? " msg-bubble--file" : ""}`}>

        {hasFile && isImage && (
          <a href={fileHref} target="_blank" rel="noopener noreferrer" className="msg-bubble-img-link">
            <img src={fileHref} alt={msg.fileName} className="msg-bubble-img" />
          </a>
        )}

        {hasFile && !isImage && (
          <div className="msg-bubble-file">
            <div className="msg-bubble-file-icon"><FiFileText size={20} /></div>
            <div className="msg-bubble-file-info">
              <span className="msg-bubble-file-name">{msg.fileName}</span>
              <span className="msg-bubble-file-size">{formatFileSize(msg.fileSize)}</span>
            </div>
            <a href={fileHref} download={msg.fileName} className="msg-bubble-download" title={t("profile.downloadCV")}>
              <FiDownload size={14} />
            </a>
          </div>
        )}

        {msg.content && <p className="msg-bubble-text">{msg.content}</p>}
        <span className="msg-bubble-time">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
}

/* ── Date separator ───────────────────────────────────── */
function DateSeparator({ groupKey, t }) {
  const label =
    groupKey === "today"     ? t("messages.groupToday")     :
    groupKey === "yesterday" ? t("messages.groupYesterday") :
    groupKey;
  return (
    <div className="msg-date-sep">
      <span className="msg-date-sep-label">{label}</span>
    </div>
  );
}

/* ── Emoji picker ─────────────────────────────────────── */
function EmojiPicker({ pickerRef, onSelect }) {
  return (
    <div className="msg-emoji-picker" ref={pickerRef}>
      {EMOJIS.map((emoji) => (
        <button key={emoji} type="button" className="msg-emoji-item"
          onClick={() => onSelect(emoji)} aria-label={emoji}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

/* ── Empty chat states ────────────────────────────────── */
function EmptyChat({ t }) {
  return (
    <div className="msg-chat-empty">
      <div className="msg-chat-empty-icon"><FiMessageSquare size={40} /></div>
      <h3 className="msg-chat-empty-title">{t("messages.selectConversation")}</h3>
      <p className="msg-chat-empty-desc">{t("messages.selectConversationDesc")}</p>
    </div>
  );
}

function NewConvEmpty({ partnerName, t }) {
  return (
    <div className="msg-chat-empty">
      <div className="msg-chat-empty-icon"><FiUserPlus size={40} /></div>
      <h3 className="msg-chat-empty-title">{t("messages.newConversation")}</h3>
      <p className="msg-chat-empty-desc">{t("messages.newConversationDesc", { name: partnerName })}</p>
    </div>
  );
}

/* ── Context panel ────────────────────────────────────── */
function ContextPanel({ partner, t }) {
  const color = avatarColor(partner.name || "");
  return (
    <div className="msg-context">
      <h4 className="msg-context-title">{t("messages.contextTitle")}</h4>
      <div className="msg-context-avatar" style={{ background: color }}>
        {partner.avatarUrl
          ? <img src={partner.avatarUrl} alt="" className="msg-context-avatar__img"/>
          : (partner.name?.[0]?.toUpperCase() || "?")}
      </div>
      <p className="msg-context-name">{partner.name}</p>
      <p className="msg-context-role">
        <RoleIcon role={partner.role} size={12} />
        {t(`messages.${roleKey(partner.role)}`)}
      </p>
      {partner.specialty && (
        <p className="msg-context-meta">{partner.specialty}</p>
      )}
      {partner.university && (
        <p className="msg-context-meta">{partner.university}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════ */
export default function MessagingPage() {
  const { t }    = useTranslation();
  const { user } = useAuth();
  const myId     = user?._id;

  /* ── State ─────────────────────────────────────────── */
  const [activeTab,       setActiveTab]       = useState("conversations");
  const [conversations,   setConversations]   = useState([]);
  const [students,        setStudents]        = useState([]);
  const [activeMessages,  setActiveMessages]  = useState([]);
  const [activeConvId,    setActiveConvId]    = useState(null);
  const [activePartnerId, setActivePartnerId] = useState(null);
  const [draftPartner,    setDraftPartner]    = useState(null);
  const [loadingList,     setLoadingList]     = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingChat,     setLoadingChat]     = useState(false);
  const [sending,         setSending]         = useState(false);
  const [uploading,       setUploading]       = useState(false);
  const [inputText,       setInputText]       = useState("");
  const [pendingFile,     setPendingFile]     = useState(null);
  const [fileError,       setFileError]       = useState("");
  const [search,          setSearch]          = useState("");
  const [studentSearch,   setStudentSearch]   = useState("");
  const [filter,          setFilter]          = useState("all");
  const [mobileView,      setMobileView]      = useState("list");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const fileInputRef   = useRef(null);
  const emojiPickerRef = useRef(null);
  const chatPollerRef  = useRef(null);
  const listPollerRef  = useRef(null);

  /* ── Load conversations ─────────────────────────────── */
  const loadList = useCallback(() => {
    messagesService.getConversations()
      .then(({ data }) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadList();
    listPollerRef.current = setInterval(loadList, 15000);
    return () => clearInterval(listPollerRef.current);
  }, [loadList]);

  /* ── Load students ──────────────────────────────────── */
  useEffect(() => {
    messagesService.getStudents()
      .then(({ data }) => setStudents(data.students || []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  /* ── Stats ──────────────────────────────────────────── */
  const stats = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return {
      conversations: conversations.length,
      unread:        conversations.reduce((s, c) => s + (c.unreadCount || 0), 0),
      todayActive:   conversations.filter((c) => new Date(c.lastMessageAt) >= todayStart).length,
      withStudents:  students.length,
    };
  }, [conversations, students]);

  /* ── Filtered conversations ─────────────────────────── */
  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => (c.otherUser?.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [conversations, filter, search]);

  /* ── Filtered students ──────────────────────────────── */
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.specialty   || "").toLowerCase().includes(q) ||
      (s.university  || "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  /* ── Active conversation object ─────────────────────── */
  const activeConv = useMemo(
    () => conversations.find((c) => String(c._id) === activeConvId) || null,
    [conversations, activeConvId]
  );

  /* ── Display partner (existing conv OR draft) ───────── */
  const displayPartner = activeConv?.otherUser || draftPartner || null;

  /* ── Load chat messages ─────────────────────────────── */
  const loadChat = useCallback((convId, silent = false) => {
    if (!silent) setLoadingChat(true);
    messagesService.getConversationMessages(convId)
      .then(({ data }) => {
        setActiveMessages(data.messages || []);
        setConversations((prev) =>
          prev.map((c) => String(c._id) === convId ? { ...c, unreadCount: 0 } : c)
        );
      })
      .catch(() => {})
      .finally(() => { if (!silent) setLoadingChat(false); });
  }, []);

  /* Poll messages every 8s on active conversation */
  useEffect(() => {
    clearInterval(chatPollerRef.current);
    if (!activeConvId) return;
    chatPollerRef.current = setInterval(() => loadChat(activeConvId, true), 8000);
    return () => clearInterval(chatPollerRef.current);
  }, [activeConvId, loadChat]);

  /* ── Auto-focus on conversation open ───────────────── */
  useEffect(() => {
    if (!activePartnerId) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [activePartnerId]);

  /* ── Close emoji picker on outside click ───────────── */
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

  /* ── Auto-scroll ────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  /* ── Select existing conversation ───────────────────── */
  const handleSelectConv = useCallback((conv) => {
    const convId = String(conv._id);
    setActiveConvId(convId);
    setActivePartnerId(String(conv.otherUser?._id));
    setDraftPartner(null);
    setInputText("");
    setPendingFile(null);
    setFileError("");
    setShowEmojiPicker(false);
    setMobileView("chat");
    loadChat(convId);
  }, [loadChat]);

  /* ── Click on a student: open existing conv or draft ── */
  const handleStartConvWithStudent = useCallback((student) => {
    const existing = conversations.find(
      (c) => String(c.otherUser?._id) === String(student._id)
    );
    if (existing) {
      handleSelectConv(existing);
      return;
    }
    setActiveConvId(null);
    setActivePartnerId(String(student._id));
    setDraftPartner(student);
    setActiveMessages([]);
    setInputText("");
    setPendingFile(null);
    setFileError("");
    setShowEmojiPicker(false);
    setMobileView("chat");
  }, [conversations, handleSelectConv]);

  /* ── Textarea auto-resize ───────────────────────────── */
  const handleTextareaChange = useCallback((e) => {
    setInputText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  /* ── Emoji click ────────────────────────────────────── */
  const handleEmojiClick = useCallback((emoji) => {
    const ta = inputRef.current;
    if (!ta) { setInputText((p) => p + emoji); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = inputText.slice(0, start) + emoji + inputText.slice(end);
    setInputText(next);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    });
  }, [inputText]);

  /* ── File selection ─────────────────────────────────── */
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setFileError("Fichier trop volumineux (max 10 MB)");
      setTimeout(() => setFileError(""), 4000);
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setFileError("Type non supporté. Acceptés : PDF, DOC, DOCX, PNG, JPG");
      setTimeout(() => setFileError(""), 4000);
      return;
    }

    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setPendingFile({ file, previewUrl, name: file.name, size: file.size });
  }, []);

  const handleCancelFile = useCallback(() => {
    setPendingFile((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  /* ── Send message ───────────────────────────────────── */
  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if ((!content && !pendingFile) || !activePartnerId || sending || uploading) return;

    /* ── Envoi avec fichier ── */
    if (pendingFile) {
      setUploading(true);
      setShowEmojiPicker(false);

      const formData = new FormData();
      formData.append("file", pendingFile.file);
      formData.append("receiverId", activePartnerId);
      if (activeConvId) formData.append("conversationId", activeConvId);
      if (content)      formData.append("content", content);

      if (pendingFile.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      setInputText("");
      if (inputRef.current) inputRef.current.style.height = "auto";

      try {
        const { data } = await messagesService.uploadFile(formData);
        setActiveMessages((prev) => [...prev, data.message]);
        if (!activeConvId && data.conversationId) {
          setActiveConvId(String(data.conversationId));
          setDraftPartner(null);
        }
        loadList();
      } catch {
        setFileError("Échec de l'envoi du fichier");
        setTimeout(() => setFileError(""), 4000);
      } finally {
        setUploading(false);
        inputRef.current?.focus();
      }
      return;
    }

    /* ── Envoi texte seul (logique optimiste existante) ── */
    const optimistic = {
      _id:        `tmp-${Date.now()}`,
      senderId:   { _id: myId, name: user?.name, role: user?.role },
      receiverId: { _id: activePartnerId, name: displayPartner?.name, role: displayPartner?.role },
      content,
      isRead:     false,
      createdAt:  new Date().toISOString(),
    };

    setActiveMessages((prev) => [...prev, optimistic]);
    setInputText("");
    setShowEmojiPicker(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setSending(true);

    try {
      const { data } = await messagesService.send({
        receiverId:     activePartnerId,
        content,
        conversationId: activeConvId || undefined,
      });
      setActiveMessages((prev) =>
        prev.map((m) => m._id === optimistic._id ? data.message : m)
      );
      if (!activeConvId && data.conversationId) {
        setActiveConvId(String(data.conversationId));
        setDraftPartner(null);
      }
      loadList();
    } catch {
      setActiveMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, pendingFile, activeConvId, activePartnerId, sending, uploading, myId, user, displayPartner, loadList]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape") setShowEmojiPicker(false);
  }, [handleSend]);

  /* ── Message groups ─────────────────────────────────── */
  const messageGroups = useMemo(() => groupMessagesByDate(activeMessages), [activeMessages]);

  const subtitle = loadingList
    ? ""
    : t("messages.subtitle_other", { count: conversations.length });

  const isChatOpen = Boolean(activeConvId || draftPartner);

  /* ── Render ─────────────────────────────────────────── */
  return (
    <DashboardLayout title={t("messages.title")} subtitle={subtitle}>
      <div className="msg-page">

        {/* ── Stats ── */}
        <div className="msg-stats">
          <StatCard value={loadingList ? "—" : stats.conversations}  label={t("messages.statConversations")} icon={FiMessageSquare} color="#6366F1" />
          <StatCard value={loadingList ? "—" : stats.unread}         label={t("messages.statUnread")}        icon={FiUsers}         color="#F59E0B" />
          <StatCard value={loadingList ? "—" : stats.todayActive}    label={t("messages.statToday")}         icon={FiFileText}      color="#10B981" />
          <StatCard value={loadingStudents ? "—" : stats.withStudents} label={t("messages.statStudents")}    icon={FiUserPlus}      color="#8B5CF6" />
        </div>

        {/* ── Chat shell ── */}
        <div className={`msg-shell${mobileView === "chat" ? " msg-shell--chat-open" : ""}`}>

          {/* ── Left panel ── */}
          <div className="msg-conv-panel">

            {/* Tab bar */}
            <div className="msg-tab-bar">
              <button
                type="button"
                className={`msg-tab${activeTab === "conversations" ? " msg-tab--active" : ""}`}
                onClick={() => setActiveTab("conversations")}
              >
                <FiMessageSquare size={13} />
                {t("messages.tabConversations")}
                {stats.unread > 0 && <span className="msg-tab-badge">{stats.unread > 99 ? "99+" : stats.unread}</span>}
              </button>
              <button
                type="button"
                className={`msg-tab${activeTab === "students" ? " msg-tab--active" : ""}`}
                onClick={() => setActiveTab("students")}
              >
                <FiUsers size={13} />
                {t("messages.tabStudents")}
              </button>
            </div>

            {activeTab === "conversations" ? (
              <>
                {/* Search + filter */}
                <div className="msg-conv-toolbar">
                  <div className="msg-search-wrap">
                    <FiSearch size={13} className="msg-search-icon" />
                    <input
                      type="text"
                      className="msg-search"
                      placeholder={t("messages.searchPlaceholder")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button type="button" className="msg-search-clear" onClick={() => setSearch("")}>
                        <FiX size={12} />
                      </button>
                    )}
                  </div>
                  <div className="msg-filter-tabs">
                    {["all","unread"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`msg-filter-tab${filter === key ? " msg-filter-tab--active" : ""}`}
                        onClick={() => setFilter(key)}
                      >
                        {t(`messages.filter${key === "all" ? "All" : "Unread"}`)}
                        {key === "unread" && stats.unread > 0 && (
                          <span className="msg-filter-count">{stats.unread}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="msg-conv-list">
                  {loadingList ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonConvItem key={i} />)
                  ) : filtered.length === 0 ? (
                    <div className="msg-conv-empty">
                      <FiMessageSquare size={28} />
                      <p>{filter === "unread" ? t("messages.noConversationsFiltered") : t("messages.noConversations")}</p>
                      <span>{filter === "unread" ? t("messages.noConversationsFilteredDesc") : t("messages.noConversationsDesc")}</span>
                    </div>
                  ) : (
                    filtered.map((conv) => (
                      <ConvItem
                        key={String(conv._id)}
                        conv={conv}
                        isActive={String(conv._id) === activeConvId}
                        myId={myId}
                        onClick={() => handleSelectConv(conv)}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Student search */}
                <div className="msg-conv-toolbar">
                  <div className="msg-search-wrap">
                    <FiSearch size={13} className="msg-search-icon" />
                    <input
                      type="text"
                      className="msg-search"
                      placeholder={t("messages.studentSearchPlaceholder")}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                    {studentSearch && (
                      <button type="button" className="msg-search-clear" onClick={() => setStudentSearch("")}>
                        <FiX size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Student list */}
                <div className="msg-student-list">
                  {loadingStudents ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonConvItem key={i} />)
                  ) : filteredStudents.length === 0 ? (
                    <div className="msg-conv-empty">
                      <FiUsers size={28} />
                      <p>{t("messages.noStudents")}</p>
                      <span>{t("messages.noStudentsDesc")}</span>
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <StudentItem
                        key={String(student._id)}
                        student={student}
                        isActive={String(activePartnerId) === String(student._id)}
                        hasConv={conversations.some(
                          (c) => String(c.otherUser?._id) === String(student._id)
                        )}
                        onClick={() => handleStartConvWithStudent(student)}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Right panel: chat ── */}
          <div className="msg-chat-panel">

            {/* Header — when a partner is selected */}
            {isChatOpen && (
              <div className="msg-chat-header">
                <button
                  type="button"
                  className="msg-back-btn"
                  onClick={() => setMobileView("list")}
                  aria-label={t("messages.back")}
                >
                  <FiChevronLeft size={18} />
                </button>
                {displayPartner && (
                  <>
                    <div className="msg-avatar msg-avatar--md" style={{ background: avatarColor(displayPartner.name || "") }}>
                      {displayPartner.avatarUrl
                        ? <img src={displayPartner.avatarUrl} alt="" className="msg-avatar__img"/>
                        : (displayPartner.name?.[0]?.toUpperCase() || "?")}
                      {activeConvId && <span className="msg-avatar-online" />}
                    </div>
                    <div className="msg-chat-header-body">
                      <span className="msg-chat-header-name">{displayPartner.name}</span>
                      <span className="msg-chat-header-role">
                        <RoleIcon role={displayPartner.role} size={11} />
                        {t(`messages.${roleKey(displayPartner.role)}`)}
                        {!activeConvId && (
                          <span className="msg-chat-header-new"> · {t("messages.newConversationBadge")}</span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Messages — always present */}
            <div className="msg-messages">
              {!isChatOpen ? (
                <EmptyChat t={t} />
              ) : !activeConvId && draftPartner ? (
                <NewConvEmpty partnerName={draftPartner.name} t={t} />
              ) : loadingChat ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonBubble key={i} mine={i % 2 === 0} />
                ))
              ) : activeMessages.length === 0 ? (
                <div className="msg-chat-empty msg-chat-empty--inline">
                  <FiMessageSquare size={28} />
                  <p>{t("messages.selectConversation")}</p>
                </div>
              ) : (
                messageGroups.map((group) => (
                  <div key={group.key}>
                    <DateSeparator groupKey={group.key} t={t} />
                    {group.messages.map((msg) => (
                      <MessageBubble key={msg._id} msg={msg} myId={myId} t={t} />
                    ))}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input — always visible */}
            <div className="msg-input-area">

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              {showEmojiPicker && activePartnerId && (
                <EmojiPicker pickerRef={emojiPickerRef} onSelect={handleEmojiClick} />
              )}

              {/* Error bar */}
              {fileError && (
                <div className="msg-error-bar" role="alert">
                  <FiX size={13} />
                  {fileError}
                </div>
              )}

              {/* File preview strip */}
              {pendingFile && (
                <div className="msg-file-preview">
                  {pendingFile.previewUrl
                    ? <img src={pendingFile.previewUrl} alt={pendingFile.name} className="msg-file-preview-thumb" />
                    : <FiFileText size={16} className="msg-file-preview-icon" />
                  }
                  <div className="msg-file-preview-info">
                    <span className="msg-file-preview-name">{pendingFile.name}</span>
                    <span className="msg-file-preview-size">{formatFileSize(pendingFile.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="msg-file-preview-remove"
                    onClick={handleCancelFile}
                    aria-label={t("fileUpload.removeFile")}
                  >
                    <FiX size={13} />
                  </button>
                </div>
              )}

              <div className="msg-input-wrap">
                <textarea
                  ref={inputRef}
                  className="msg-input"
                  placeholder={t("messages.inputPlaceholder")}
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={1000}
                  disabled={sending || uploading}
                />
                <div className="msg-input-toolbar">
                  <div className="msg-input-left">
                    <button
                      type="button"
                      className={`msg-input-action-btn${pendingFile ? " msg-input-action-btn--active" : ""}`}
                      onClick={() => activePartnerId && fileInputRef.current?.click()}
                      disabled={!activePartnerId || uploading}
                      title={t("messages.attachment")}
                      aria-label={t("messages.attachment")}
                    >
                      <FiPaperclip size={15} />
                    </button>
                    <button
                      type="button"
                      className={`msg-input-action-btn msg-input-action-btn--emoji${showEmojiPicker ? " msg-input-action-btn--active" : ""}`}
                      onClick={() => activePartnerId && setShowEmojiPicker((p) => !p)}
                      disabled={!activePartnerId}
                      title={t("messages.emoji")}
                      aria-label={t("messages.emoji")}
                    >
                      <FiSmile size={15} />
                    </button>
                    <span className="msg-input-hint">
                      {t("messages.inputHint")}
                    </span>
                  </div>
                  <div className="msg-input-right">
                    {inputText.length > 200 && (
                      <span className={`msg-char-count${inputText.length > 900 ? " msg-char-count--warn" : ""}`}>
                        {1000 - inputText.length}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`msg-send-btn${(inputText.trim() || pendingFile) && activePartnerId ? " msg-send-btn--ready" : ""}`}
                      onClick={handleSend}
                      disabled={(!inputText.trim() && !pendingFile) || !activePartnerId || sending || uploading}
                      aria-label={t("messages.send")}
                    >
                      {(sending || uploading) ? <span className="msg-send-spinner" /> : <FiSend size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Context panel (desktop only) ── */}
          {displayPartner && (
            <ContextPanel partner={displayPartner} t={t} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
