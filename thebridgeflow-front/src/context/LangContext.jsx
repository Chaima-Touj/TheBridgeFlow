import { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState(localStorage.getItem("lang") || "fr");

  // Applique la direction RTL/LTR ET la langue i18next dès le chargement,
  // pas seulement au moment où l'utilisateur clique
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem("lang", l);
  };

  return (
    <LangContext.Provider value={{ lang, changeLang }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
