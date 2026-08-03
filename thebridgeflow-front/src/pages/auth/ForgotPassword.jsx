import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LangFlags from "../../components/common/LangFlags.jsx";
import api from "../../services/api.js";
import "./VerifyEmail.css";

export default function ForgotPassword() {
  const { t } = useTranslation();

  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError(t("forgotPassword.errorRequired"));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || t("forgotPassword.errorDefault"));
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

        <div className="verify-icon">🔑</div>

        <h1 className="verify-title">{t("forgotPassword.title")}</h1>
        <p className="verify-desc">{t("forgotPassword.desc")}</p>

        {error && <div className="verify-alert verify-alert--error">❌ {error}</div>}
        {success && (
          <div className="verify-alert verify-alert--success">✅ {t("forgotPassword.successMessage")}</div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              className="verify-input"
              style={{ width: "100%", height: "48px", fontSize: "0.95rem", fontFamily: "inherit", fontWeight: 500, marginBottom: "1.25rem", textAlign: "left", padding: "0 1rem" }}
              placeholder={t("forgotPassword.emailPh")}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />

            <button type="submit" className="btn btn-primary verify-btn" disabled={loading}>
              {loading ? t("forgotPassword.sending") : t("forgotPassword.submitBtn")}
            </button>
          </form>
        )}

        <Link to="/login" className="verify-back">
          {t("forgotPassword.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
