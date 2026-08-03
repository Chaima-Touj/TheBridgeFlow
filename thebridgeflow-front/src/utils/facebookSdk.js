let loadPromise = null;

/**
 * Charge le SDK JavaScript officiel de Meta une seule fois (mise en cache de la
 * promesse) et l'initialise avec l'App ID fourni. Résout avec l'objet global `FB`.
 */
export function loadFacebookSdk(appId) {
  if (window.FB) return Promise.resolve(window.FB);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function () {
      window.FB.init({ appId, cookie: true, xfbml: false, version: "v21.0" });
      resolve(window.FB);
    };

    const script = document.createElement("script");
    script.src   = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Échec du chargement du SDK Facebook"));
    document.body.appendChild(script);
  });

  return loadPromise;
}
