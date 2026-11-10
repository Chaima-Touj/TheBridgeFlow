import { useCallback, useState } from "react";
import RecaptchaCheckbox from "../components/common/RecaptchaCheckbox.jsx";
import { RECAPTCHA_V2_SITE_KEY } from "../utils/recaptchaV2Client.js";

/**
 * Case « Je ne suis pas un robot » d'un formulaire protégé.
 * - widget : à afficher juste avant le bouton d'envoi (null si la clé v2 n'est pas configurée)
 * - missing : true tant que la case doit encore être cochée
 * - requestConfig : 3e argument de api.post(...) pour envoyer le jeton au backend
 * - reset() : à appeler après chaque envoi, réussi ou non (un jeton v2 ne sert qu'une fois)
 */
export function useRecaptchaCheckbox() {
  const enabled = Boolean(RECAPTCHA_V2_SITE_KEY);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);

  const reset = useCallback(() => {
    setToken("");
    setResetKey((key) => key + 1);
  }, []);

  return {
    enabled,
    missing: enabled && !token,
    requestConfig: token ? { recaptchaToken: token } : {},
    reset,
    widget: enabled ? <RecaptchaCheckbox onToken={setToken} resetKey={resetKey} /> : null,
  };
}
