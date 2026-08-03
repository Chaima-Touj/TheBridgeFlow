import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/auth.service.js";
import { getToken, setToken, clearToken } from "../utils/tokenStorage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage : si un token existe (localStorage ou sessionStorage), on
  // valide avec le serveur
  useEffect(() => {
    const token = getToken();
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    authService.getMe()
      .then(({ data }) => setUser(data.user))
      .catch((err) => {
        // On ne vide le token que si le serveur l'a explicitement rejeté
        // (401 = invalide/expiré). Une panne réseau, un timeout ou un cold
        // start backend (Render free tier) ne doit pas déconnecter un
        // utilisateur dont le token est encore parfaitement valide.
        if (err.response?.status === 401) {
          clearToken();
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Login standard via authService — rememberMe détermine où le token est
  // stocké : localStorage (persiste après fermeture du navigateur) si coché,
  // sessionStorage (effacé à la fermeture de l'onglet) sinon.
  const login = async (email, password, rememberMe = false) => {
    const { data } = await authService.login({ email, password, rememberMe });

    // Gérer le cas needsVerify
    if (data.needsVerify) return data;

    setToken(data.token, rememberMe);
    setUser(data.user);
    return data.user;
  };

  // Connexion directe depuis un token déjà obtenu (évite le double appel) —
  // utilisé par la vérification d'email et les connexions sociales, qui
  // n'ont pas de case "Se souvenir de moi" : persistant par défaut.
  const loginWithToken = (token, userData, rememberMe = true) => {
    setToken(token, rememberMe);
    setUser(userData);
  };

  const register = async (formData) => {
    const { data } = await authService.register(formData);
    // Si needsVerify, on ne stocke pas le token
    if (data.needsVerify) return data;
    setToken(data.token, true);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { data } = await authService.getMe();
      setUser(data.user);
      return data.user;
    } catch {
      logout();
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);