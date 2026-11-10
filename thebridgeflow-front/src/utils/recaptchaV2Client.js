// Client reCAPTCHA v2 « Je ne suis pas un robot » (case visible).
// Actif seulement si VITE_RECAPTCHA_V2_SITE_KEY est défini ; sinon aucun captcha
// n'est affiché (voir services/api.js).
export const RECAPTCHA_V2_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V2_SITE_KEY || "";

const ONLOAD_CALLBACK = "__onRecaptchaV2Load";
let scriptPromise;

// Charge le script Google une seule fois (rendu explicite, plusieurs cases possibles
// sur la même page). La langue est fixée au premier chargement.
export function loadRecaptchaV2(language = "fr") {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    window[ONLOAD_CALLBACK] = () => resolve(window.grecaptcha);
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?onload=${ONLOAD_CALLBACK}&render=explicit&hl=${encodeURIComponent(language)}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      script.remove();
      reject(new Error("Google reCAPTCHA could not be loaded."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}
