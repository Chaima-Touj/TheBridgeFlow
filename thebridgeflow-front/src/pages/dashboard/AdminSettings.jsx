import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useLang } from "../../context/LangContext.jsx";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { FiSun, FiMoon, FiCheck, FiX } from "react-icons/fi";
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

const LANGS = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "ar", label: "العربية",  flag: "🇹🇳" },
];

export default function AdminSettings() {
  const { t }                  = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { lang, changeLang }   = useLang();

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [fontSize, setFontSize] = useState(localStorage.getItem("fontSize") || "medium");

  const showToast = useCallback((type, message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const applyFontSize = (value) => {
    setFontSize(value);
    const map = { small: "13px", medium: "15px", large: "17px" };
    document.documentElement.setAttribute("data-font-size", value);
    document.documentElement.style.fontSize = map[value];
    localStorage.setItem("fontSize", value);
    showToast("success", t("adminSettings.toast.saved"));
  };

  return (
    <DashboardLayout title={t("sidebar.settings")}>
      <div className="stg-root">
        <Toast toast={toast} onDismiss={() => setToast(null)}/>

        <div className="stg-section">
          <div className="stg-section__header">
            <div className="stg-section__icon stg-section__icon--amber"><FiSun size={18}/></div>
            <div>
              <h2 className="stg-section__title">{t("adminSettings.appearance.title")}</h2>
              <p className="stg-section__desc">{t("adminSettings.appearance.desc")}</p>
            </div>
          </div>

          <div className="stg-pref-row">
            <div className="stg-pref-row__info">
              <span className="stg-pref-row__label">{t("adminSettings.appearance.mode")}</span>
              <span className="stg-pref-row__sub">{t("adminSettings.appearance.modeDesc")}</span>
            </div>
            <div className="stg-theme-switch">
              <button
                className={`stg-theme-btn ${theme === "light" ? "stg-theme-btn--active" : ""}`}
                onClick={() => theme === "dark" && toggleTheme()}
              >
                <FiSun size={14}/> {t("adminSettings.appearance.light")}
              </button>
              <button
                className={`stg-theme-btn ${theme === "dark" ? "stg-theme-btn--active" : ""}`}
                onClick={() => theme === "light" && toggleTheme()}
              >
                <FiMoon size={14}/> {t("adminSettings.appearance.dark")}
              </button>
            </div>
          </div>

          <div className="stg-divider"/>

          <div className="stg-pref-row">
            <div className="stg-pref-row__info">
              <span className="stg-pref-row__label">{t("adminSettings.appearance.lang")}</span>
              <span className="stg-pref-row__sub">{t("adminSettings.appearance.langDesc")}</span>
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
              <span className="stg-pref-row__label">{t("adminSettings.appearance.fontSize")}</span>
              <span className="stg-pref-row__sub">{t("adminSettings.appearance.fontSizeDesc")}</span>
            </div>
            <div className="stg-font-group">
              {[
                { value: "small",  labelKey: "adminSettings.appearance.small" },
                { value: "medium", labelKey: "adminSettings.appearance.medium" },
                { value: "large",  labelKey: "adminSettings.appearance.large" },
              ].map(f => (
                <button
                  key={f.value}
                  className={`stg-font-btn ${fontSize === f.value ? "stg-font-btn--active" : ""}`}
                  onClick={() => applyFontSize(f.value)}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
