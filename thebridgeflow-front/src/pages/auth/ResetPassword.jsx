import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import LangFlags from "../../components/common/LangFlags.jsx";
import api from "../../services/api.js";
import "./VerifyEmail.css";
import "./Auth.css";

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams();

  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass]               = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [success, setSuccess]                 = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("resetPassword.errorTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("resetPassword.errorMismatch"));
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err) {
      setError(err.response?.data?.message || t("resetPassword.errorDefault"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"0.5rem" }}>
          <LangFlags/>
        </div>

        <Link to="/" className="verify-logo">
          <img src="/favicon.png" alt="Logo" className="verify-logo__icon" />
          <span>TheBridge<span className="verify-logo__accent">Flow</span></span>
        </Link>

        <div className="verify-icon">🔒</div>

        <h1 className="verify-title">{t("resetPassword.title")}</h1>
        <p className="verify-desc">{t("resetPassword.desc")}</p>

        {error && <div className="verify-alert verify-alert--error">❌ {error}</div>}
        {success && (
          <div className="verify-alert verify-alert--success">✅ {t("resetPassword.successMessage")}</div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div className="auth-input-wrap" style={{ marginBottom: "0.75rem" }}>
              <span className="auth-input-icon"><FiLock size={16}/></span>
              <input
                type={showPass ? "text" : "password"}
                className="auth-input"
                placeholder={t("resetPassword.passwordPh")}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
              <button type="button" className="auth-input-toggle" onClick={() => setShowPass(!showPass)}>
                {showPass ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
              </button>
            </div>

            <div className="auth-input-wrap" style={{ marginBottom: "1.25rem" }}>
              <span className="auth-input-icon"><FiLock size={16}/></span>
              <input
                type={showPass ? "text" : "password"}
                className="auth-input"
                placeholder={t("resetPassword.confirmPh")}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary verify-btn" disabled={loading}>
              {loading ? t("resetPassword.submitting") : t("resetPassword.submitBtn")}
            </button>
          </form>
        )}

        {error && !success && (
          <Link to="/forgot-password" className="verify-back" style={{ display: "block", marginBottom: "0.5rem" }}>
            {t("resetPassword.requestNewLink")}
          </Link>
        )}

        <Link to="/login" className="verify-back">
          {t("resetPassword.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
