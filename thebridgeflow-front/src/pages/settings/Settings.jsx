import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useLang } from "../../context/LangContext.jsx";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Loader from "../../components/common/Loader.jsx";
import { profileService } from "../../services/profile.service.js";
import {
  FiUser, FiMoon, FiSun, FiBell, FiShield, FiLock, FiCpu,
  FiBriefcase, FiAlertTriangle, FiGlobe, FiCheck, FiX,
  FiSave, FiTrash2, FiEye, FiEyeOff, FiChevronRight,
  FiSmartphone, FiMail, FiBook, FiMessageSquare, FiCalendar,
} from "react-icons/fi";
import "./Settings.css";

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className={`stg-toast stg-toast--${toast.type}`} onClick={onDismiss}>
      <span className="stg-toast__icon">
        {toast.type === "success" ? <FiCheck size={15}/> : <FiX size={15}/>}
      </span>
      <span className="stg-toast__msg">{toast.message}</span>
    </div>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`stg-toggle ${checked ? "stg-toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="stg-toggle__knob"/>
    </button>
  );
}

// ─── Tag Input ───────────────────────────────────────────────────────────────

function TagInput({ tags, onAdd, onRemove, inputValue, onInputChange, placeholder }) {
  const handleKey = (e) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      onAdd(inputValue.trim());
    }
  };
  return (
    <div className="stg-tag-input">
      {tags.map((tag, i) => (
        <span key={i} className="stg-tag">
          {tag}
          <button type="button" onClick={() => onRemove(i)}><FiX size={11}/></button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="stg-tag-input__field"
      />
    </div>
  );
}

// ─── Password Field ──────────────────────────────────────────────────────────

function PwdField({ label, value, onChange, show, onToggleShow }) {
  return (
    <div className="stg-field">
      <label className="stg-label">{label}</label>
      <div className="stg-input-wrap">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="stg-input"
          autoComplete="new-password"
        />
        <button type="button" className="stg-input-eye" onClick={onToggleShow}>
          {show ? <FiEyeOff size={15}/> : <FiEye size={15}/>}
        </button>
      </div>
    </div>
  );
}

// ─── Sections config (labelKey used with t()) ────────────────────────────────

const SECTIONS = [
  { id: "compte",          labelKey: "settings.nav.compte",          icon: FiUser },
  { id: "apparence",       labelKey: "settings.nav.apparence",       icon: FiSun },
  { id: "notifications",   labelKey: "settings.nav.notifications",   icon: FiBell },
  { id: "confidentialite", labelKey: "settings.nav.confidentialite", icon: FiShield },
  { id: "securite",        labelKey: "settings.nav.securite",        icon: FiLock },
  { id: "ia",              labelKey: "settings.nav.ia",              icon: FiCpu },
  { id: "preferences",     labelKey: "settings.nav.preferences",     icon: FiBriefcase },
  { id: "danger",          labelKey: "settings.nav.danger",          icon: FiAlertTriangle },
];

const LANGS = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "ar", label: "العربية",  flag: "🇹🇳" },
];

const STAGE_TYPES = ["", "Stage", "PFE", "Alternance", "CDI", "CDD"];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Settings() {
  const { t }                         = useTranslation();
  const { user, logout, refreshUser } = useAuth();
  const { theme, toggleTheme }        = useTheme();
  const { lang, changeLang }          = useLang();
  const navigate                      = useNavigate();

  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSection, setActiveSection] = useState("compte");
  const [toast,         setToast]         = useState(null);
  const [saving,        setSaving]        = useState(false);
  const toastTimer                        = useRef(null);

  // ── Section: Compte ──
  const [compteForm, setCompteForm] = useState({ name: "", phone: "", university: "", specialty: "" });

  // ── Section: Sécurité ──
  const [pwdForm, setPwdForm] = useState({ current: "", nouveau: "", confirm: "" });
  const [pwdShow, setPwdShow] = useState({ current: false, nouveau: false, confirm: false });

  // ── Section: Notifications ──
  const [notifs, setNotifs] = useState({
    newOffers: true, newApplications: true, interviews: true,
    messages: true, formations: true, emails: true,
  });

  // ── Section: Confidentialité ──
  const [privacy, setPrivacy] = useState({
    profileVisibility: "public", cvVisibility: true, allowCompanyView: true,
  });

  // ── Section: IA ──
  const [aiPref, setAiPref] = useState({ enableRecommendations: true });

  // ── Section: Préférences Stage ──
  const [stagePrefs, setStagePrefs]     = useState({ locations: [], type: "", technologies: [], duration: "" });
  const [locationInput, setLocationInput] = useState("");
  const [techInput,     setTechInput]     = useState("");

  // ── Section: Apparence ──
  const [fontSize, setFontSize] = useState(localStorage.getItem("fontSize") || "medium");

  // ── Section: Zone Danger ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword,  setDeletePassword]  = useState("");
  const [showDeletePwd,   setShowDeletePwd]   = useState(false);

  // Delete-account modal: Escape to close + lock body scroll while open
  useEffect(() => {
    if (!showDeleteModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e) => { if (e.key === "Escape") setShowDeleteModal(false); };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [showDeleteModal]);

  // Font size global effect
  useEffect(() => {
    const map = { small: "13px", medium: "15px", large: "17px" };
    document.documentElement.setAttribute("data-font-size", fontSize);
    document.documentElement.style.fontSize = map[fontSize];
    localStorage.setItem("fontSize", fontSize);
  }, [fontSize]);

  // Load profile from MongoDB
  useEffect(() => {
    profileService.getMyProfile()
      .then(({ data }) => {
        const p = data.user || data;
        setProfile(p);
        setCompteForm({
          name:       p.name       || "",
          phone:      p.phone      || "",
          university: p.university || "",
          specialty:  p.specialty  || "",
        });
        if (p.settings?.notifications)
          setNotifs(n  => ({ ...n,  ...p.settings.notifications }));
        if (p.settings?.privacy)
          setPrivacy(pr => ({ ...pr, ...p.settings.privacy }));
        if (p.settings?.ai)
          setAiPref(a  => ({ ...a,  ...p.settings.ai }));
        if (p.settings?.internshipPreferences)
          setStagePrefs(s => ({ ...s, ...p.settings.internshipPreferences }));
      })
      .catch(() => showToast("error", t("settings.toast.loadError")))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((type, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Save: Compte ─────────────────────────────────────────────────────────
  const saveCompte = async () => {
    if (!compteForm.name.trim()) return showToast("error", t("settings.errors.nameRequired"));
    setSaving(true);
    try {
      await profileService.updateProfile(compteForm);
      await refreshUser();
      showToast("success", t("settings.toast.profileSaved"));
    } catch (e) {
      showToast("error", e?.response?.data?.message || t("settings.toast.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // ── Save: Mot de passe ───────────────────────────────────────────────────
  const savePassword = async () => {
    if (!pwdForm.current || !pwdForm.nouveau || !pwdForm.confirm)
      return showToast("error", t("settings.errors.allFieldsRequired"));
    if (pwdForm.nouveau.length < 6)
      return showToast("error", t("settings.errors.minLength6"));
    if (pwdForm.nouveau !== pwdForm.confirm)
      return showToast("error", t("settings.errors.passwordMismatch"));

    setSaving(true);
    try {
      await profileService.changePassword({ currentPassword: pwdForm.current, newPassword: pwdForm.nouveau });
      setPwdForm({ current: "", nouveau: "", confirm: "" });
      showToast("success", t("settings.toast.pwdSaved"));
    } catch (e) {
      showToast("error", e?.response?.data?.message || t("settings.errors.passwordRequired"));
    } finally {
      setSaving(false);
    }
  };

  // ── Save: Settings génériques ────────────────────────────────────────────
  const saveSettings = async (payload) => {
    setSaving(true);
    try {
      await profileService.updateSettings(payload);
      showToast("success", t("settings.toast.saveSuccess"));
    } catch {
      showToast("error", t("settings.toast.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete account ───────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!deletePassword) return showToast("error", t("settings.errors.passwordRequired"));
    setSaving(true);
    try {
      await profileService.deleteAccount({ password: deletePassword });
      logout();
      navigate("/login");
    } catch (e) {
      showToast("error", e?.response?.data?.message || t("settings.errors.passwordRequired"));
    } finally {
      setSaving(false);
    }
  };

  // ── Tag helpers ──────────────────────────────────────────────────────────
  const addLocation = (val) => {
    if (!stagePrefs.locations.includes(val))
      setStagePrefs(s => ({ ...s, locations: [...s.locations, val] }));
    setLocationInput("");
  };
  const removeLocation = (i) =>
    setStagePrefs(s => ({ ...s, locations: s.locations.filter((_, idx) => idx !== i) }));

  const addTech = (val) => {
    if (!stagePrefs.technologies.includes(val))
      setStagePrefs(s => ({ ...s, technologies: [...s.technologies, val] }));
    setTechInput("");
  };
  const removeTech = (i) =>
    setStagePrefs(s => ({ ...s, technologies: s.technologies.filter((_, idx) => idx !== i) }));

  // ─── Section renders ──────────────────────────────────────────────────────

  const renderCompte = () => (
    <div className="stg-section">
      <div className="stg-section__header">
        <div className="stg-section__icon stg-section__icon--blue"><FiUser size={18}/></div>
        <div>
          <h2 className="stg-section__title">{t("settings.compte.title")}</h2>
          <p className="stg-section__desc">{t("settings.compte.desc")}</p>
        </div>
      </div>

      <div className="stg-field-grid">
        <div className="stg-field">
          <label className="stg-label">{t("settings.compte.fullName")}</label>
          <input
            className="stg-input"
            value={compteForm.name}
            onChange={e => setCompteForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="stg-field">
          <label className="stg-label">{t("settings.compte.email")}</label>
          <input className="stg-input stg-input--readonly" value={profile?.email || ""} readOnly/>
          <span className="stg-hint">{t("settings.compte.emailHint")}</span>
        </div>
        <div className="stg-field">
          <label className="stg-label">{t("settings.compte.phone")}</label>
          <input
            className="stg-input"
            value={compteForm.phone}
            onChange={e => setCompteForm(f => ({ ...f, phone: e.target.value }))}
            placeholder={t("settings.compte.phonePlaceholder")}
          />
        </div>
        <div className="stg-field">
          <label className="stg-label">{t("settings.compte.university")}</label>
          <input
            className="stg-input"
            value={compteForm.university}
            onChange={e => setCompteForm(f => ({ ...f, university: e.target.value }))}
            placeholder={t("settings.compte.universityPlaceholder")}
          />
        </div>
        <div className="stg-field stg-field--full">
          <label className="stg-label">{t("settings.compte.specialty")}</label>
          <input
            className="stg-input"
            value={compteForm.specialty}
            onChange={e => setCompteForm(f => ({ ...f, specialty: e.target.value }))}
            placeholder={t("settings.compte.specialtyPlaceholder")}
          />
        </div>
      </div>

      <div className="stg-actions">
        <button className="stg-btn stg-btn--primary" onClick={saveCompte} disabled={saving}>
          <FiSave size={15}/>
          {saving ? t("settings.compte.saving") : t("settings.compte.save")}
        </button>
      </div>
    </div>
  );

  const renderApparence = () => (
    <div className="stg-section">
      <div className="stg-section__header">
        <div className="stg-section__icon stg-section__icon--amber"><FiSun size={18}/></div>
        <div>
          <h2 className="stg-section__title">{t("settings.apparence.title")}</h2>
          <p className="stg-section__desc">{t("settings.apparence.desc")}</p>
        </div>
      </div>

      <div className="stg-pref-row">
        <div className="stg-pref-row__info">
          <span className="stg-pref-row__label">{t("settings.apparence.mode")}</span>
          <span className="stg-pref-row__sub">{t("settings.apparence.modeDesc")}</span>
        </div>
        <div className="stg-theme-switch">
          <button
            className={`stg-theme-btn ${theme === "light" ? "stg-theme-btn--active" : ""}`}
            onClick={() => theme === "dark" && toggleTheme()}
          >
            <FiSun size={14}/> {t("settings.apparence.light")}
          </button>
          <button
            className={`stg-theme-btn ${theme === "dark" ? "stg-theme-btn--active" : ""}`}
            onClick={() => theme === "light" && toggleTheme()}
          >
            <FiMoon size={14}/> {t("settings.apparence.dark")}
          </button>
        </div>
      </div>

      <div className="stg-divider"/>

      <div className="stg-pref-row">
        <div className="stg-pref-row__info">
          <span className="stg-pref-row__label">{t("settings.apparence.lang")}</span>
          <span className="stg-pref-row__sub">{t("settings.apparence.langDesc")}</span>
        </div>
        <div className="stg-lang-group">
          {LANGS.map(l => (
            <button
              key={l.code}
              className={`stg-lang-btn ${lang === l.code ? "stg-lang-btn--active" : ""}`}
              onClick={() => changeLang(l.code)}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="stg-divider"/>

      <div className="stg-pref-row">
        <div className="stg-pref-row__info">
          <span className="stg-pref-row__label">{t("settings.apparence.fontSize")}</span>
          <span className="stg-pref-row__sub">{t("settings.apparence.fontSizeDesc")}</span>
        </div>
        <div className="stg-font-group">
          {[
            { value: "small",  labelKey: "settings.apparence.small" },
            { value: "medium", labelKey: "settings.apparence.medium" },
            { value: "large",  labelKey: "settings.apparence.large" },
          ].map(f => (
            <button
              key={f.value}
              className={`stg-font-btn ${fontSize === f.value ? "stg-font-btn--active" : ""}`}
              onClick={() => setFontSize(f.value)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => {
    const items = [
      { key: "newOffers",       labelKey: "settings.notifications.newOffers",    subKey: "settings.notifications.newOffersDesc",    Icon: FiBriefcase },
      { key: "newApplications", labelKey: "settings.notifications.applications", subKey: "settings.notifications.applicationsDesc", Icon: FiBook },
      { key: "interviews",      labelKey: "settings.notifications.interviews",   subKey: "settings.notifications.interviewsDesc",   Icon: FiCalendar },
      { key: "messages",        labelKey: "settings.notifications.messages",     subKey: "settings.notifications.messagesDesc",     Icon: FiMessageSquare },
      { key: "formations",      labelKey: "settings.notifications.formations",   subKey: "settings.notifications.formationsDesc",   Icon: FiBook },
      { key: "emails",          labelKey: "settings.notifications.emails",       subKey: "settings.notifications.emailsDesc",       Icon: FiMail },
    ];
    return (
      <div className="stg-section">
        <div className="stg-section__header">
          <div className="stg-section__icon stg-section__icon--green"><FiBell size={18}/></div>
          <div>
            <h2 className="stg-section__title">{t("settings.notifications.title")}</h2>
            <p className="stg-section__desc">{t("settings.notifications.desc")}</p>
          </div>
        </div>

        <div className="stg-toggle-list">
          {items.map(({ key, labelKey, subKey, Icon }) => (
            <div key={key} className="stg-toggle-row">
              <div className="stg-toggle-row__icon"><Icon size={16}/></div>
              <div className="stg-toggle-row__info">
                <span className="stg-toggle-row__label">{t(labelKey)}</span>
                <span className="stg-toggle-row__sub">{t(subKey)}</span>
              </div>
              <Toggle
                checked={notifs[key]}
                onChange={v => setNotifs(n => ({ ...n, [key]: v }))}
              />
            </div>
          ))}
        </div>

        <div className="stg-actions">
          <button className="stg-btn stg-btn--primary" onClick={() => saveSettings({ notifications: notifs })} disabled={saving}>
            <FiSave size={15}/>
            {saving ? t("settings.notifications.saving") : t("settings.notifications.save")}
          </button>
        </div>
      </div>
    );
  };

  const renderConfidentialite = () => {
    const visibilityOptions = [
      { value: "public",      labelKey: "settings.privacy.visibilityPublic" },
      { value: "connections", labelKey: "settings.privacy.visibilityConnections" },
      { value: "private",     labelKey: "settings.privacy.visibilityPrivate" },
    ];
    return (
      <div className="stg-section">
        <div className="stg-section__header">
          <div className="stg-section__icon stg-section__icon--purple"><FiShield size={18}/></div>
          <div>
            <h2 className="stg-section__title">{t("settings.privacy.title")}</h2>
            <p className="stg-section__desc">{t("settings.privacy.desc")}</p>
          </div>
        </div>

        <div className="stg-field">
          <label className="stg-label">{t("settings.privacy.profileVisibility")}</label>
          <select
            className="stg-select"
            value={privacy.profileVisibility}
            onChange={e => setPrivacy(p => ({ ...p, profileVisibility: e.target.value }))}
          >
            {visibilityOptions.map(o => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
            ))}
          </select>
        </div>

        <div className="stg-toggle-list" style={{ marginTop: "1rem" }}>
          <div className="stg-toggle-row">
            <div className="stg-toggle-row__icon"><FiEye size={16}/></div>
            <div className="stg-toggle-row__info">
              <span className="stg-toggle-row__label">{t("settings.privacy.cvVisibility")}</span>
              <span className="stg-toggle-row__sub">{t("settings.privacy.cvVisibilityDesc")}</span>
            </div>
            <Toggle checked={privacy.cvVisibility} onChange={v => setPrivacy(p => ({ ...p, cvVisibility: v }))}/>
          </div>
          <div className="stg-toggle-row">
            <div className="stg-toggle-row__icon"><FiBriefcase size={16}/></div>
            <div className="stg-toggle-row__info">
              <span className="stg-toggle-row__label">{t("settings.privacy.allowCompanyView")}</span>
              <span className="stg-toggle-row__sub">{t("settings.privacy.allowCompanyViewDesc")}</span>
            </div>
            <Toggle checked={privacy.allowCompanyView} onChange={v => setPrivacy(p => ({ ...p, allowCompanyView: v }))}/>
          </div>
        </div>

        <div className="stg-actions">
          <button className="stg-btn stg-btn--primary" onClick={() => saveSettings({ privacy })} disabled={saving}>
            <FiSave size={15}/>
            {saving ? t("settings.privacy.saving") : t("settings.privacy.save")}
          </button>
        </div>
      </div>
    );
  };

  const renderSecurite = () => {
    const pwdLen = pwdForm.nouveau.length;
    const strength = pwdLen >= 8 ? "strong" : pwdLen >= 6 ? "medium" : "weak";
    return (
      <div className="stg-section">
        <div className="stg-section__header">
          <div className="stg-section__icon stg-section__icon--red"><FiLock size={18}/></div>
          <div>
            <h2 className="stg-section__title">{t("settings.security.title")}</h2>
            <p className="stg-section__desc">{t("settings.security.desc")}</p>
          </div>
        </div>

        <div className="stg-card-inner">
          <h3 className="stg-subsection-title">{t("settings.security.changePassword")}</h3>
          <div className="stg-field-grid">
            <PwdField
              label={t("settings.security.currentPassword")}
              value={pwdForm.current}
              onChange={v => setPwdForm(f => ({ ...f, current: v }))}
              show={pwdShow.current}
              onToggleShow={() => setPwdShow(s => ({ ...s, current: !s.current }))}
            />
            <PwdField
              label={t("settings.security.newPassword")}
              value={pwdForm.nouveau}
              onChange={v => setPwdForm(f => ({ ...f, nouveau: v }))}
              show={pwdShow.nouveau}
              onToggleShow={() => setPwdShow(s => ({ ...s, nouveau: !s.nouveau }))}
            />
            <PwdField
              label={t("settings.security.confirmPassword")}
              value={pwdForm.confirm}
              onChange={v => setPwdForm(f => ({ ...f, confirm: v }))}
              show={pwdShow.confirm}
              onToggleShow={() => setPwdShow(s => ({ ...s, confirm: !s.confirm }))}
            />
          </div>
          {pwdForm.nouveau && (
            <div className="stg-pwd-strength">
              <div className={`stg-pwd-bar stg-pwd-bar--${strength}`}/>
              <span className="stg-hint">{t(`settings.security.pwd${strength.charAt(0).toUpperCase() + strength.slice(1)}`)}</span>
            </div>
          )}
          <div className="stg-actions">
            <button className="stg-btn stg-btn--primary" onClick={savePassword} disabled={saving}>
              <FiLock size={15}/>
              {saving ? t("settings.security.saving") : t("settings.security.save")}
            </button>
          </div>
        </div>

        <div className="stg-card-inner stg-card-inner--muted" style={{ marginTop: "1rem" }}>
          <h3 className="stg-subsection-title">{t("settings.security.activeSessions")}</h3>
          <div className="stg-session-row">
            <div className="stg-session-icon"><FiSmartphone size={18}/></div>
            <div className="stg-session-info">
              <span className="stg-session-name">{t("settings.security.currentSession")}</span>
              <span className="stg-session-sub">{t("settings.security.sessionSub")} — {new Date().toLocaleDateString()}</span>
            </div>
            <span className="stg-session-badge">{t("settings.security.sessionActive")}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderIA = () => (
    <div className="stg-section">
      <div className="stg-section__header">
        <div className="stg-section__icon stg-section__icon--indigo"><FiCpu size={18}/></div>
        <div>
          <h2 className="stg-section__title">{t("settings.ai.title")}</h2>
          <p className="stg-section__desc">{t("settings.ai.desc")}</p>
        </div>
      </div>

      <div className="stg-toggle-list">
        <div className="stg-toggle-row">
          <div className="stg-toggle-row__icon"><FiCpu size={16}/></div>
          <div className="stg-toggle-row__info">
            <span className="stg-toggle-row__label">{t("settings.ai.recommendations")}</span>
            <span className="stg-toggle-row__sub">{t("settings.ai.recommendationsDesc")}</span>
          </div>
          <Toggle
            checked={aiPref.enableRecommendations}
            onChange={v => setAiPref(a => ({ ...a, enableRecommendations: v }))}
          />
        </div>
      </div>

      <div className="stg-card-inner stg-card-inner--muted" style={{ marginTop: "1rem" }}>
        <h3 className="stg-subsection-title">{t("settings.ai.history")}</h3>
        <p className="stg-body-text">{t("settings.ai.historyDesc")}</p>
        <button
          className="stg-btn stg-btn--ghost"
          style={{ marginTop: "0.75rem" }}
          onClick={() => {
            localStorage.removeItem("sage_history");
            showToast("success", t("settings.ai.resetSuccess"));
          }}
        >
          <FiX size={14}/> {t("settings.ai.resetHistory")}
        </button>
      </div>

      <div className="stg-actions">
        <button className="stg-btn stg-btn--primary" onClick={() => saveSettings({ ai: aiPref })} disabled={saving}>
          <FiSave size={15}/>
          {saving ? t("settings.ai.saving") : t("settings.ai.save")}
        </button>
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="stg-section">
      <div className="stg-section__header">
        <div className="stg-section__icon stg-section__icon--teal"><FiBriefcase size={18}/></div>
        <div>
          <h2 className="stg-section__title">{t("settings.preferences.title")}</h2>
          <p className="stg-section__desc">{t("settings.preferences.desc")}</p>
        </div>
      </div>

      <div className="stg-field-grid">
        <div className="stg-field stg-field--full">
          <label className="stg-label">{t("settings.preferences.locations")}</label>
          <TagInput
            tags={stagePrefs.locations}
            onAdd={addLocation}
            onRemove={removeLocation}
            inputValue={locationInput}
            onInputChange={setLocationInput}
            placeholder={t("settings.preferences.locationsPlaceholder")}
          />
        </div>

        <div className="stg-field">
          <label className="stg-label">{t("settings.preferences.type")}</label>
          <select
            className="stg-select"
            value={stagePrefs.type}
            onChange={e => setStagePrefs(s => ({ ...s, type: e.target.value }))}
          >
            {STAGE_TYPES.map(tp => (
              <option key={tp} value={tp}>{tp || t("settings.preferences.typeDefault")}</option>
            ))}
          </select>
        </div>

        <div className="stg-field">
          <label className="stg-label">{t("settings.preferences.duration")}</label>
          <input
            className="stg-input"
            value={stagePrefs.duration}
            onChange={e => setStagePrefs(s => ({ ...s, duration: e.target.value }))}
            placeholder={t("settings.preferences.durationPlaceholder")}
          />
        </div>

        <div className="stg-field stg-field--full">
          <label className="stg-label">{t("settings.preferences.technologies")}</label>
          <TagInput
            tags={stagePrefs.technologies}
            onAdd={addTech}
            onRemove={removeTech}
            inputValue={techInput}
            onInputChange={setTechInput}
            placeholder={t("settings.preferences.technologiesPlaceholder")}
          />
        </div>
      </div>

      <div className="stg-actions">
        <button className="stg-btn stg-btn--primary" onClick={() => saveSettings({ internshipPreferences: stagePrefs })} disabled={saving}>
          <FiSave size={15}/>
          {saving ? t("settings.preferences.saving") : t("settings.preferences.save")}
        </button>
      </div>
    </div>
  );

  const renderDanger = () => (
    <div className="stg-section stg-section--danger">
      <div className="stg-section__header">
        <div className="stg-section__icon stg-section__icon--danger"><FiAlertTriangle size={18}/></div>
        <div>
          <h2 className="stg-section__title stg-section__title--danger">{t("settings.danger.title")}</h2>
          <p className="stg-section__desc">{t("settings.danger.desc")}</p>
        </div>
      </div>

      <div className="stg-danger-card">
        <div className="stg-danger-card__info">
          <h3 className="stg-danger-card__title">{t("settings.danger.deleteTitle")}</h3>
          <p className="stg-danger-card__desc">{t("settings.danger.deleteDesc")}</p>
        </div>
        <button className="stg-btn stg-btn--danger" onClick={() => setShowDeleteModal(true)}>
          <FiTrash2 size={14}/> {t("settings.danger.deleteBtn")}
        </button>
      </div>

      {showDeleteModal && (
        <div className="stg-modal-overlay" onClick={() => setShowDeleteModal(false)} role="dialog" aria-modal="true">
          <div className="stg-modal" onClick={e => e.stopPropagation()}>
            <div className="stg-modal__header">
              <div className="stg-modal__icon"><FiAlertTriangle size={22}/></div>
              <h3 className="stg-modal__title">{t("settings.danger.modal.title")}</h3>
            </div>
            <p className="stg-modal__body">{t("settings.danger.modal.body")}</p>
            <div className="stg-input-wrap" style={{ marginBottom: "1rem" }}>
              <input
                type={showDeletePwd ? "text" : "password"}
                className="stg-input"
                placeholder={t("settings.danger.modal.pwdPlaceholder")}
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
              />
              <button type="button" className="stg-input-eye" onClick={() => setShowDeletePwd(s => !s)}>
                {showDeletePwd ? <FiEyeOff size={15}/> : <FiEye size={15}/>}
              </button>
            </div>
            <div className="stg-modal__footer">
              <button
                className="stg-btn stg-btn--ghost"
                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); }}
              >
                {t("settings.danger.modal.cancel")}
              </button>
              <button className="stg-btn stg-btn--danger" onClick={handleDeleteAccount} disabled={saving}>
                <FiTrash2 size={14}/>
                {saving ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case "compte":          return renderCompte();
      case "apparence":       return renderApparence();
      case "notifications":   return renderNotifications();
      case "confidentialite": return renderConfidentialite();
      case "securite":        return renderSecurite();
      case "ia":              return renderIA();
      case "preferences":     return renderPreferences();
      case "danger":          return renderDanger();
      default:                return null;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={t("settings.pageTitle")}>
        <div className="stg-loading">
          <Loader size="lg" label={t("settings.loading")} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t("settings.pageTitle")}>
      <div className="stg-root">
        <Toast toast={toast} onDismiss={() => setToast(null)}/>

        <div className="stg-layout">
          {/* ── Navigation latérale ── */}
          <nav className="stg-nav" aria-label={t("settings.pageTitle")}>
            <div className="stg-nav__profile">
              <div className="stg-nav__avatar">
                {user?.avatarUrl
                  ? <img src={user.avatarUrl} alt="" className="stg-nav__avatar-img"/>
                  : (user?.name?.[0]?.toUpperCase() || "U")}
              </div>
              <div className="stg-nav__profile-info">
                <span className="stg-nav__profile-name">{user?.name}</span>
                <span className="stg-nav__profile-email">{user?.email}</span>
              </div>
            </div>

            <div className="stg-nav__sep"/>

            {SECTIONS.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                className={`stg-nav__item ${activeSection === id ? "stg-nav__item--active" : ""} ${id === "danger" ? "stg-nav__item--danger" : ""}`}
                onClick={() => setActiveSection(id)}
              >
                <span className="stg-nav__item-icon"><Icon size={16}/></span>
                <span className="stg-nav__item-label">{t(labelKey)}</span>
                <FiChevronRight size={13} className="stg-nav__item-chevron"/>
              </button>
            ))}
          </nav>

          {/* ── Contenu de section ── */}
          <div className="stg-content">
            {renderSection()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
