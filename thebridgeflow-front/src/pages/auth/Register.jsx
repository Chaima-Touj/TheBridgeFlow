import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiUser } from "react-icons/fi";
import LangFlags from "../../components/common/LangFlags.jsx";
import GoogleAuthButton from "../../components/common/GoogleAuthButton.jsx";
import AuthOrbit from "../../components/auth/AuthOrbit.jsx";
import api from "../../services/api.js";
import "./Auth.css";

const passwordRequirements = [
  (value) => value.length >= 8,
  (value) => /\p{Lu}/u.test(value),
  (value) => /\d/u.test(value),
  (value) => /[^\p{L}\p{N}\s]/u.test(value),
];

const Field = ({ id, label, error, children }) => (
  <div className="auth-field">
    <label className="auth-label" htmlFor={id}>{label}</label>
    {children}
    {error && <p className="register-field-error" id={`${id}-error`}>{error}</p>}
  </div>
);

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const submitting = useRef(false);

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  };

  const validate = () => {
    const nextErrors = {};
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const email = values.email.trim();

    if (!firstName) nextErrors.firstName = t("register.errorFirstNameRequired");
    if (!lastName) nextErrors.lastName = t("register.errorLastNameRequired");
    if (!email) {
      nextErrors.email = t("register.errorEmailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = t("register.errorEmailInvalid");
    }
    if (!values.password) {
      nextErrors.password = t("register.errorPasswordRequired");
    } else if (passwordRequirements.some((test) => !test(values.password))) {
      nextErrors.password = t("register.errorPasswordRequirements");
    }
    if (!values.confirmPassword) {
      nextErrors.confirmPassword = t("register.errorConfirmRequired");
    } else if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = t("register.errorPasswordMismatch");
    }
    if (!values.acceptedTerms) nextErrors.acceptedTerms = t("register.errorTermsRequired");

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    if (submitting.current || !validate()) return;

    submitting.current = true;
    setLoading(true);
    const payload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
      acceptedTerms: values.acceptedTerms,
    };

    try {
      const { data } = await api.post("/auth/register", payload);
      if (data.needsVerify) {
        navigate("/verify-email", { state: { email: data.email } });
      }
    } catch (error) {
      setFormError(error.response?.data?.message || t("register.errorDefault"));
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--register">
      <div className="auth-left">
        <AuthOrbit />
        <Link to="/" className="auth-left__logo">
          <img src="/favicon.png" alt="Logo" className="auth-left__logo-icon" />
          <span>TheBridge<span style={{ opacity: 0.85 }}>Flow</span></span>
        </Link>
        <div className="auth-left__content">
          <h2 className="auth-left__title">{t("login.left1")}<br />{t("login.left2")}</h2>
          <p className="auth-left__sub">{t("login.leftSub")}</p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap register-form-wrap">
          <div className="register-language">
            <LangFlags />
          </div>

          <h1 className="auth-form-title register-title">{t("register.title")}</h1>
          <p className="register-subtitle">{t("register.subtitle")}</p>

          {formError && <div className="auth-error" role="alert">{formError}</div>}

          <form className="auth-form-body" onSubmit={handleSubmit} noValidate>
            <div className="register-grid">
              <Field id="register-first-name" label={t("register.firstName")} error={errors.firstName}>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><FiUser size={15} /></span>
                  <input
                    id="register-first-name"
                    className="auth-input"
                    type="text"
                    autoComplete="given-name"
                    required
                    placeholder={t("register.firstNamePlaceholder")}
                    value={values.firstName}
                    onChange={(event) => updateValue("firstName", event.target.value)}
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={errors.firstName ? "register-first-name-error" : undefined}
                  />
                </div>
              </Field>

              <Field id="register-last-name" label={t("register.lastName")} error={errors.lastName}>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><FiUser size={15} /></span>
                  <input
                    id="register-last-name"
                    className="auth-input"
                    type="text"
                    autoComplete="family-name"
                    required
                    placeholder={t("register.lastNamePlaceholder")}
                    value={values.lastName}
                    onChange={(event) => updateValue("lastName", event.target.value)}
                    aria-invalid={Boolean(errors.lastName)}
                    aria-describedby={errors.lastName ? "register-last-name-error" : undefined}
                  />
                </div>
              </Field>
            </div>

            <Field id="register-email" label={t("register.email")} error={errors.email}>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><FiMail size={15} /></span>
                <input
                  id="register-email"
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t("register.emailPlaceholder")}
                  value={values.email}
                  onChange={(event) => updateValue("email", event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "register-email-error" : undefined}
                />
              </div>
            </Field>

            <div className="register-grid">
              <Field id="register-password" label={t("register.password")} error={errors.password}>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><FiLock size={15} /></span>
                  <input
                    id="register-password"
                    className="auth-input"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    placeholder={t("register.passwordPlaceholder")}
                    value={values.password}
                    onChange={(event) => updateValue("password", event.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "register-password-error" : "register-password-hint"}
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t("register.hidePassword") : t("register.showPassword")}
                  >
                    {showPassword ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
                <p className="register-password-hint" id="register-password-hint">
                  {t("register.passwordRequirements")}
                </p>
              </Field>

              <Field id="register-confirm-password" label={t("register.confirmPassword")} error={errors.confirmPassword}>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><FiLock size={15} /></span>
                  <input
                    id="register-confirm-password"
                    className="auth-input"
                    type={showConfirmation ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    placeholder={t("register.passwordPlaceholder")}
                    value={values.confirmPassword}
                    onChange={(event) => updateValue("confirmPassword", event.target.value)}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "register-confirm-password-error" : undefined}
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowConfirmation((visible) => !visible)}
                    aria-label={showConfirmation ? t("register.hidePassword") : t("register.showPassword")}
                  >
                    {showConfirmation ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </Field>
            </div>

            <div className="register-terms-field">
              <label className="register-terms" htmlFor="register-terms">
                <input
                  id="register-terms"
                  type="checkbox"
                  required
                  checked={values.acceptedTerms}
                  onChange={(event) => updateValue("acceptedTerms", event.target.checked)}
                  aria-invalid={Boolean(errors.acceptedTerms)}
                  aria-describedby={errors.acceptedTerms ? "register-terms-error" : undefined}
                />
                <span>
                  {t("register.termsBefore")}
                  <Link to="/conditions">{t("register.termsLink")}</Link>
                  {t("register.termsBetween")}
                  <Link to="/confidentialite">{t("register.privacyLink")}</Link>
                  {t("register.termsAfter")}
                </span>
              </label>
              {errors.acceptedTerms && (
                <p className="register-field-error" id="register-terms-error">{errors.acceptedTerms}</p>
              )}
            </div>

            <button type="submit" className="auth-submit-btn register-submit" disabled={loading}>
              {loading ? t("register.creating") : t("register.createAccount")}
              {!loading && <FiArrowRight size={17} />}
            </button>
          </form>

          <div className="auth-separator register-separator">
            <span /><em>{t("login.or")}</em><span />
          </div>
          <div className="auth-socials register-socials">
            <GoogleAuthButton onError={setFormError} />
          </div>
          <p className="auth-switch register-switch">
            {t("register.alreadyAccount")} <Link to="/login">{t("nav.signIn")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
