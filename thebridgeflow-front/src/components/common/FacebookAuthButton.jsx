import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import api from "../../services/api.js";
import { loadFacebookSdk } from "../../utils/facebookSdk.js";

const ROUTES = {
  étudiant: "/dashboard/student",
  admin:    "/dashboard/admin",
};

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

/**
 * Bouton "Continuer avec Facebook" — charge le SDK Meta à la volée, déclenche le
 * popup FB.login(), vérifie le jeton côté serveur puis connecte l'utilisateur.
 * Se dégrade en bouton désactivé si VITE_FACEBOOK_APP_ID n'est pas configuré.
 */
export default function FacebookAuthButton({ onError }) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const FB = await loadFacebookSdk(FACEBOOK_APP_ID);
      FB.login((response) => {
        handleFbResponse(response).finally(() => setLoading(false));
      }, { scope: "email,public_profile" });
    } catch {
      onError?.("Connexion Facebook impossible pour le moment.");
      setLoading(false);
    }
  };

  const handleFbResponse = async (response) => {
    if (!response.authResponse?.accessToken) {
      onError?.("Connexion Facebook annulée.");
      return;
    }
    try {
      const { data } = await api.post("/auth/facebook", { accessToken: response.authResponse.accessToken });
      loginWithToken(data.token, data.user);
      navigate(ROUTES[data.user?.role] || "/dashboard/student");
    } catch (err) {
      onError?.(err.response?.data?.message || "Connexion Facebook impossible. Réessayez.");
    }
  };

  if (!FACEBOOK_APP_ID) {
    return (
      <button
        type="button"
        className="auth-social-btn auth-social-btn--disabled"
        disabled
        title="Connexion Facebook bientôt disponible"
      >
        <FacebookIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="auth-social-btn"
      title="Continuer avec Facebook"
      onClick={handleClick}
      disabled={loading}
    >
      <FacebookIcon />
    </button>
  );
}
