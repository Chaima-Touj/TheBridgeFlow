import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { profileService } from "../../services/profile.service.js";
import {
  FiUser, FiLock, FiCheck, FiX, FiSave,
  FiEye, FiEyeOff, FiSmartphone,
} from "react-icons/fi";
import "../settings/Settings.css";

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

export default function AdminProfile() {
  const { t }              = useTranslation();
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);
  const toastTimer = useRef(null);

  const [accountForm, setAccountForm] = useState({ name: "", phone: "" });
  const [pwdForm, setPwdForm]         = useState({ current: "", nouveau: "", confirm: "" });
  const [pwdShow, setPwdShow]         = useState({ current: false, nouveau: false, confirm: false });

  useEffect(() => {
    profileService.getMyProfile()
      .then(({ data }) => {
        const p = data.user || data;
        setProfile(p);
        setAccountForm({ name: p.name || "", phone: p.phone || "" });
      })
      .catch(() => showToast("error", t("adminProfile.errors.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((type, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const saveAccount = async () => {
    if (!accountForm.name.trim()) return showToast("error", t("adminProfile.errors.nameRequired"));
    setSaving(true);
    try {
      await profileService.updateProfile(accountForm);
      await refreshUser();
      showToast("success", t("adminProfile.toast.accountSaved"));
    } catch (e) {
      showToast("error", e?.response?.data?.message || t("adminProfile.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!pwdForm.current || !pwdForm.nouveau || !pwdForm.confirm)
      return showToast("error", t("adminProfile.errors.allFieldsRequired"));
    if (pwdForm.nouveau.length < 6)
      return showToast("error", t("adminProfile.errors.minLength6"));
    if (pwdForm.nouveau !== pwdForm.confirm)
      return showToast("error", t("adminProfile.errors.passwordMismatch"));

    setSaving(true);
    try {
      await profileService.changePassword({ currentPassword: pwdForm.current, newPassword: pwdForm.nouveau });
      setPwdForm({ current: "", nouveau: "", confirm: "" });
      showToast("success", t("adminProfile.toast.pwdSaved"));
    } catch (e) {
      showToast("error", e?.response?.data?.message || t("adminProfile.errors.passwordFailed"));
    } finally {
      setSaving(false);
    }
  };

  const pwdLen = pwdForm.nouveau.length;
  const strength = pwdLen >= 8 ? "strong" : pwdLen >= 6 ? "medium" : "weak";

  if (loading) {
    return (
      <DashboardLayout title={t("adminProfile.pageTitle")}>
        <div className="stg-loading">
          <div className="stg-loading__spinner"/>
          <p>{t("adminProfile.loading")}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t("adminProfile.pageTitle")}>
      <div className="stg-root">
        <Toast toast={toast} onDismiss={() => setToast(null)}/>

        <div className="stg-section">
          <div className="stg-section__header">
            <div className="stg-section__icon stg-section__icon--blue"><FiUser size={18}/></div>
            <div>
              <h2 className="stg-section__title">{t("adminProfile.account.title")}</h2>
              <p className="stg-section__desc">{t("adminProfile.account.desc")}</p>
            </div>
          </div>

          <div className="stg-field-grid">
            <div className="stg-field">
              <label className="stg-label">{t("adminProfile.account.fullName")}</label>
              <input
                className="stg-input"
                value={accountForm.name}
                onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="stg-field">
              <label className="stg-label">{t("adminProfile.account.email")}</label>
              <input className="stg-input stg-input--readonly" value={profile?.email || ""} readOnly/>
              <span className="stg-hint">{t("adminProfile.account.emailHint")}</span>
            </div>
            <div className="stg-field">
              <label className="stg-label">{t("adminProfile.account.phone")}</label>
              <input
                className="stg-input"
                value={accountForm.phone}
                onChange={e => setAccountForm(f => ({ ...f, phone: e.target.value }))}
                placeholder={t("adminProfile.account.phonePlaceholder")}
              />
            </div>
            <div className="stg-field">
              <label className="stg-label">{t("adminProfile.account.role")}</label>
              <input className="stg-input stg-input--readonly" value={t("sidebar.roles.admin")} readOnly/>
            </div>
          </div>

          <div className="stg-actions">
            <button className="stg-btn stg-btn--primary" onClick={saveAccount} disabled={saving}>
              <FiSave size={15}/>
              {saving ? t("adminProfile.account.saving") : t("adminProfile.account.save")}
            </button>
          </div>
        </div>

        <div className="stg-section">
          <div className="stg-section__header">
            <div className="stg-section__icon stg-section__icon--red"><FiLock size={18}/></div>
            <div>
              <h2 className="stg-section__title">{t("adminProfile.security.title")}</h2>
              <p className="stg-section__desc">{t("adminProfile.security.desc")}</p>
            </div>
          </div>

          <div className="stg-card-inner">
            <div className="stg-field-grid">
              <PwdField
                label={t("adminProfile.security.currentPassword")}
                value={pwdForm.current}
                onChange={v => setPwdForm(f => ({ ...f, current: v }))}
                show={pwdShow.current}
                onToggleShow={() => setPwdShow(s => ({ ...s, current: !s.current }))}
              />
              <PwdField
                label={t("adminProfile.security.newPassword")}
                value={pwdForm.nouveau}
                onChange={v => setPwdForm(f => ({ ...f, nouveau: v }))}
                show={pwdShow.nouveau}
                onToggleShow={() => setPwdShow(s => ({ ...s, nouveau: !s.nouveau }))}
              />
              <PwdField
                label={t("adminProfile.security.confirmPassword")}
                value={pwdForm.confirm}
                onChange={v => setPwdForm(f => ({ ...f, confirm: v }))}
                show={pwdShow.confirm}
                onToggleShow={() => setPwdShow(s => ({ ...s, confirm: !s.confirm }))}
              />
            </div>
            {pwdForm.nouveau && (
              <div className="stg-pwd-strength">
                <div className={`stg-pwd-bar stg-pwd-bar--${strength}`}/>
                <span className="stg-hint">{t(`adminProfile.security.pwd${strength.charAt(0).toUpperCase() + strength.slice(1)}`)}</span>
              </div>
            )}
            <div className="stg-actions">
              <button className="stg-btn stg-btn--primary" onClick={savePassword} disabled={saving}>
                <FiLock size={15}/>
                {saving ? t("adminProfile.security.saving") : t("adminProfile.security.save")}
              </button>
            </div>
          </div>

          <div className="stg-card-inner stg-card-inner--muted" style={{ marginTop: "1rem" }}>
            <h3 className="stg-subsection-title">{t("adminProfile.security.activeSessions")}</h3>
            <div className="stg-session-row">
              <div className="stg-session-icon"><FiSmartphone size={18}/></div>
              <div className="stg-session-info">
                <span className="stg-session-name">{t("adminProfile.security.currentSession")}</span>
                <span className="stg-session-sub">{t("adminProfile.security.sessionSub")} — {new Date().toLocaleDateString()}</span>
              </div>
              <span className="stg-session-badge">{t("adminProfile.security.sessionActive")}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
