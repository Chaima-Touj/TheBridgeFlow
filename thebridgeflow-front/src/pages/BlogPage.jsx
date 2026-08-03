import SiteNavbar from "../components/common/SiteNavbar.jsx";
import NewsSection from "../components/common/NewsSection.jsx";
import { useLang } from "../context/LangContext.jsx";
import "./FormationsPage.css";

// Page dédiée "Actualités" — réutilise NewsSection (branché sur GET
// /api/news, géré depuis le dashboard admin) au lieu de dupliquer la grille
// de cards. NewsSection porte déjà son propre en-tête (badge/titre/
// sous-titre), donc pas de fp-hero ici pour éviter un titre dupliqué.
export default function BlogPage() {
  const { lang } = useLang();

  return (
    <div className="fp-page">
      <SiteNavbar />
      <NewsSection lang={lang} standalone />
    </div>
  );
}
