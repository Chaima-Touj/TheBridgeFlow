import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext.jsx";
import { RECAPTCHA_V2_SITE_KEY, loadRecaptchaV2 } from "../../utils/recaptchaV2Client.js";
import "./RecaptchaCheckbox.css";

/**
 * Case reCAPTCHA v2 « Je ne suis pas un robot ».
 * - onToken(token) reçoit le jeton quand la case est cochée, et "" quand il expire,
 *   en cas d'erreur ou quand la case disparaît.
 * - Incrémenter resetKey décoche la case (un jeton v2 ne sert qu'une seule fois).
 * Utiliser plutôt le hook useRecaptchaCheckbox() dans les formulaires.
 */
export default function RecaptchaCheckbox({ onToken, resetKey = 0 }) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme() || {};
  const hostRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const [loadError, setLoadError] = useState(false);
  const language = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2);
  const widgetTheme = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  // (Re)crée la case au montage et quand le thème change : Google ne permet pas
  // de changer le thème d'une case existante.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;

    loadRecaptchaV2(language)
      .then((grecaptcha) => {
        if (cancelled) return;
        setLoadError(false);
        const target = document.createElement("div");
        host.replaceChildren(target);
        widgetIdRef.current = grecaptcha.render(target, {
          sitekey: RECAPTCHA_V2_SITE_KEY,
          theme: widgetTheme,
          // La case normale fait 304 px : version compacte sur les écrans étroits.
          size: host.clientWidth > 0 && host.clientWidth < 304 ? "compact" : "normal",
          callback: (token) => onTokenRef.current?.(token),
          "expired-callback": () => onTokenRef.current?.(""),
          "error-callback": () => onTokenRef.current?.(""),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      widgetIdRef.current = null;
      host.replaceChildren();
      onTokenRef.current?.("");
    };
  }, [language, widgetTheme]);

  useEffect(() => {
    if (resetKey && widgetIdRef.current !== null) {
      window.grecaptcha?.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  return (
    <div className="recaptcha-checkbox">
      <div ref={hostRef} className="recaptcha-checkbox__widget" />
      {loadError && (
        <p className="recaptcha-checkbox__error" role="alert">{t("captcha.loadError")}</p>
      )}
    </div>
  );
}
