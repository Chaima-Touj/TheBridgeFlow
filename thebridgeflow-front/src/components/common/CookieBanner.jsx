import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./CookieBanner.css";

// Bannière purement informative pour l'instant : "Accepter" et "Refuser"
// ferment toutes les deux le bandeau et mémorisent le choix, mais aucun des
// deux ne conditionne réellement le chargement de GA4/Google Sign-In (voir
// App.jsx:initGA / main.jsx:GoogleOAuthProvider) — à faire dans une itération
// ultérieure si un vrai blocage RGPD est requis.
const CONSENT_KEY = "cookie_consent";

export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY));

  const choose = (value) => {
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label={t("cookieBanner.message")}>
      <p className="cookie-banner__text">
        {t("cookieBanner.message")}{" "}
        <Link to="/confidentialite" className="cookie-banner__link">{t("cookieBanner.privacyLink")}</Link>
      </p>
      <div className="cookie-banner__actions">
        <button type="button" className="btn btn-outline cookie-banner__btn" onClick={() => choose("refused")}>
          {t("cookieBanner.refuse")}
        </button>
        <button type="button" className="btn btn-primary cookie-banner__btn" onClick={() => choose("accepted")}>
          {t("cookieBanner.accept")}
        </button>
      </div>
    </div>
  );
}
