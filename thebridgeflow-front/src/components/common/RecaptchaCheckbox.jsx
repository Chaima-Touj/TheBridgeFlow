import { useEffect, useRef } from "react";

let scriptPromise;

function loadRecaptcha(language) {
  if (window.grecaptcha?.render) {
    return new Promise((resolve) => window.grecaptcha.ready(() => resolve(window.grecaptcha)));
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit&hl=${encodeURIComponent(language)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.grecaptcha?.render) {
        reject(new Error("reCAPTCHA checkbox failed to initialize."));
        return;
      }
      window.grecaptcha.ready(() => resolve(window.grecaptcha));
    };
    script.onerror = () => reject(new Error("reCAPTCHA checkbox could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export default function RecaptchaCheckbox({ language, onToken, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  useEffect(() => {
    let active = true;
    const siteKey = import.meta.env.VITE_RECAPTCHA_V2_SITE_KEY;
    if (!siteKey) {
      onErrorRef.current("not-configured");
      return undefined;
    }

    loadRecaptcha(language)
      .then((recaptcha) => {
        if (!active || !containerRef.current) return;
        widgetIdRef.current = recaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onErrorRef.current("unavailable"),
        });
      })
      .catch(() => {
        if (active) onErrorRef.current("unavailable");
      });

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
        window.grecaptcha.reset(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [language]);

  return <div ref={containerRef} className="auth-recaptcha" />;
}
