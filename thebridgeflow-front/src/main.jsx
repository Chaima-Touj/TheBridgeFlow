import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { LangProvider } from "./context/LangContext.jsx";
import "./i18n/index.js";
import App from "./App.jsx";
import { canonicalHostUrl } from "./utils/canonicalHost.js";
import "./index.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// www.9antra.tn → 9antra.tn (même page) : une seule adresse, donc la même
// session, la même API et la même connexion Google dans tous les navigateurs.
const canonicalUrl = canonicalHostUrl(window.location, import.meta.env.VITE_API_URL);

const appTree = (
  <BrowserRouter>
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  </BrowserRouter>
);

if (canonicalUrl) {
  window.location.replace(canonicalUrl);
} else {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      {googleClientId
        ? <GoogleOAuthProvider clientId={googleClientId} locale="fr">{appTree}</GoogleOAuthProvider>
        : appTree}
    </StrictMode>
  );
}
