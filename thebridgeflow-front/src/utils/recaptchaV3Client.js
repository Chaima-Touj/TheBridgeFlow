const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
const scriptUrl = "https://www.google.com/recaptcha/api.js";

let scriptPromise;
let requestQueue = Promise.resolve();

function loadRecaptcha() {
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${scriptUrl}?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.grecaptcha) {
        reject(new Error("Google reCAPTCHA failed to initialize."));
        return;
      }
      window.grecaptcha.ready(() => resolve(window.grecaptcha));
    };
    script.onerror = () => reject(new Error("Google reCAPTCHA could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

async function executeRecaptcha() {
  const recaptcha = await loadRecaptcha();
  const token = await recaptcha.execute(siteKey, { action: "submit" });
  if (typeof token !== "string" || !token) {
    throw new Error("Google reCAPTCHA did not return a verification token.");
  }
  return token;
}

export function getRecaptchaToken() {
  if (!siteKey) {
    return Promise.reject(new Error("Google reCAPTCHA is not configured. Set VITE_RECAPTCHA_SITE_KEY."));
  }
  const pendingRequest = requestQueue.then(executeRecaptcha);
  requestQueue = pendingRequest.catch(() => {});
  return pendingRequest;
}
