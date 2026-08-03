// Le token JWT vit dans l'un des deux stockages navigateur, jamais les deux à
// la fois : localStorage (persiste après fermeture du navigateur — "Se
// souvenir de moi") ou sessionStorage (effacé à la fermeture de l'onglet —
// comportement par défaut). Centralisé ici pour que api.js et AuthContext
// restent d'accord sur où chercher/écrire le token.
const KEY = "token";

export function getToken() {
  return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
}

export function setToken(token, persist) {
  if (persist) {
    localStorage.setItem(KEY, token);
    sessionStorage.removeItem(KEY);
  } else {
    sessionStorage.setItem(KEY, token);
    localStorage.removeItem(KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
