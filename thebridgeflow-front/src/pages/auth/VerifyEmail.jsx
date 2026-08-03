import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext.jsx";
import LangFlags from "../../components/common/LangFlags.jsx";
import api from "../../services/api.js";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { loginWithToken } = useAuth();

  // L'email est transmis via location.state depuis Login/Register
  const email = location.state?.email || "";

  const [digits, setDigits]     = useState(["", "", "", "", "", ""]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef([]);

  // Rediriger si pas d'email
  useEffect(() => {
    if (!email) navigate("/login", { replace: true });
  }, [email, navigate]);

  // Countdown pour le bouton "Renvoyer"
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Focus sur le premier champ au chargement
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return; // chiffres uniquement
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    setError("");

    // Auto-focus sur le champ suivant
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit si tous les chiffres sont saisis
    if (value && index === 5) {
      const code = [...newDigits.slice(0, 5), value].join("");
      if (code.length === 6) handleVerify(code);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeOverride) => {
    const code = codeOverride || digits.join("");
    if (code.length !== 6) {
      setError(t("verifyEmail.errorIncomplete"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/verify-email", { email, code });
      setSuccess(t("verifyEmail.successVerified"));

      // Mettre à jour AuthContext (token + user) — même logique que Login.jsx
      loginWithToken(data.token, data.user);

      setTimeout(() => {
        const role = data.user?.role;
        if (role === "étudiant") navigate("/dashboard/student", { replace: true });
        else                     navigate("/dashboard",         { replace: true });
      }, 1200);

    } catch (err) {
      const msg = err.response?.data?.message || t("verifyEmail.errorDefault");
      setError(msg);
      // Vider les champs en cas d'erreur
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await api.post("/auth/resend-code", { email });
      setSuccess(t("verifyEmail.successResent"));
      setCountdown(60); // 60 secondes avant de pouvoir renvoyer
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.message || t("verifyEmail.errorResend"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"0.5rem" }}>
          <LangFlags/>
        </div>

        {/* Logo */}
        <Link to="/" className="verify-logo">
          <img src="/favicon.png" alt="Logo" className="verify-logo__icon" />
          <span>TheBridge<span className="verify-logo__accent">Flow</span></span>
        </Link>

        {/* Icône */}
        <div className="verify-icon">🔐</div>

        <h1 className="verify-title">{t("verifyEmail.title")}</h1>
        <p className="verify-desc">
          {t("verifyEmail.desc")}<br/>
          <strong>{email}</strong>
        </p>

        {/* Messages */}
        {error   && <div className="verify-alert verify-alert--error">❌ {error}</div>}
        {success && <div className="verify-alert verify-alert--success">✅ {success}</div>}

        {/* Champs code */}
        <div className="verify-inputs" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`verify-input ${digit ? "verify-input--filled" : ""}`}
              disabled={loading}
              autoComplete="off"
            />
          ))}
        </div>

        <p className="verify-expire">⏱️ {t("verifyEmail.expireNotice")}</p>

        {/* Bouton vérifier */}
        <button
          className="btn btn-primary verify-btn"
          onClick={() => handleVerify()}
          disabled={loading || digits.join("").length < 6}
        >
          {loading ? t("verifyEmail.verifying") : t("verifyEmail.verifyBtn")}
        </button>

        {/* Renvoyer le code */}
        <div className="verify-resend">
          <span>{t("verifyEmail.noCodeReceived")}</span>
          <button
            className="verify-resend__btn"
            onClick={handleResend}
            disabled={resending || countdown > 0}
          >
            {resending
              ? t("verifyEmail.resending")
              : countdown > 0
              ? t("verifyEmail.resendCountdown", { count: countdown })
              : t("verifyEmail.resendBtn")}
          </button>
        </div>

        <button className="verify-back" onClick={() => navigate("/login")}>
          ← {t("verifyEmail.backToLogin")}
        </button>
      </div>
    </div>
  );
}