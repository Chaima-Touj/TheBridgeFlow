import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import LangFlags from "../../components/common/LangFlags.jsx";
import GoogleAuthButton from "../../components/common/GoogleAuthButton.jsx";
import AuthOrbit from "../../components/auth/AuthOrbit.jsx";
import BoxReveal from "../../components/auth/BoxReveal.jsx";
import Loader from "../../components/common/Loader.jsx";
import api from "../../services/api.js";
import "./Auth.css";

const ROUTES = {
  étudiant: "/dashboard/student",
  admin:    "/dashboard/admin",
};

export default function Login() {
  const { t } = useTranslation();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(t("login.errorRequired"));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password, rememberMe: remember });

      // Email non vérifié
      if (data.needsVerify) {
        navigate("/verify-email", { state: { email: data.email } });
        return;
      }

      // Mettre à jour AuthContext sans refaire un appel API
      loginWithToken(data.token, data.user, remember);
      const returnTo = location.state?.from;
      const safeReturnTo = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//");
      navigate(safeReturnTo ? returnTo : ROUTES[data.user?.role] || "/dashboard/student");

    } catch (err) {
      const d = err.response?.data;
      if (d?.needsVerify) {
        navigate("/verify-email", { state: { email: d.email } });
        return;
      }
      setError(d?.message || t("login.errorDefault"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      {/* ── Panneau gauche ──────────────────────────────────────────────── */}
      <div className="auth-left">
        <AuthOrbit/>

        <Link to="/" className="auth-left__logo">
          <img src="/favicon.png" alt="Logo" className="auth-left__logo-icon" />
          <span>TheBridge<span style={{opacity:0.85}}>Flow</span></span>
        </Link>

        <div className="auth-left__content">
          <h2 className="auth-left__title">{t("login.left1")}<br/>{t("login.left2")}</h2>
          <p className="auth-left__sub">{t("login.leftSub")}</p>
        </div>
      </div>

      {/* ── Panneau droit ───────────────────────────────────────────────── */}
      <div className="auth-right">
        <div className="auth-form-wrap">

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <LangFlags/>
          </div>

          {/* Icône marque */}
          <Link to="/" className="auth-brand-icon-link">
            <img src="/favicon.png" alt="Logo" className="auth-brand-icon" />
          </Link>

          <BoxReveal width="100%"><h1 className="auth-form-title">{t("login.title")}</h1></BoxReveal>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form-body" noValidate>

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label">{t("profile.email")}</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><FiMail size={16}/></span>
                <input type="email" className="auth-input" placeholder={t("login.emailPh")}
                  value={email} onChange={e => setEmail(e.target.value)} required/>
              </div>
            </div>

            {/* Mot de passe */}
            <div className="auth-field">
              <label className="auth-label">{t("profileEditor.password")}</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><FiLock size={16}/></span>
                <input type={showPass ? "text" : "password"} className="auth-input"
                  placeholder={t("login.passwordPh")} value={password}
                  onChange={e => setPassword(e.target.value)} required/>
                <button type="button" className="auth-input-toggle"
                  onClick={() => setShowPass(!showPass)}>
                  {showPass ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="auth-row">
              <label className="auth-checkbox">
                <input type="checkbox" checked={remember}
                  onChange={e => setRemember(e.target.checked)}/>
                <span>{t("login.remember")}</span>
              </label>
              <Link to="/forgot-password" className="auth-forgot">{t("login.forgot")}</Link>
            </div>

            {/* Bouton connexion */}
            <BoxReveal width="100%">
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <Loader size="sm" className="auth-submit-btn__loader" /> : t("nav.signIn")}
              </button>
            </BoxReveal>

            {/* Séparateur */}
            <div className="auth-separator">
              <span/><em>{t("login.or")}</em><span/>
            </div>

            {/* Boutons sociaux */}
            <div className="auth-socials">
              <GoogleAuthButton onError={setError} />
            </div>

            {/* Lien inscription */}
            <p className="auth-switch">
              {t("login.noAccount")}{" "}<Link to="/register">{t("login.signup")}</Link>
            </p>

          </form>
        </div>
      </div>
    </div>
  );
}
