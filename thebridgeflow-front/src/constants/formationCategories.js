// Regroupement des formations par catégorie. Le modèle Formation n'a pas de
// champ "category" — ce mapping vit côté client (même logique que ICON_MAP
// dans LandingPage.jsx/FormationDetail.jsx), tenu à jour manuellement en
// fonction des slugs réels. Seules les catégories ayant au moins une
// formation réelle sont listées ci-dessous.
import { FiCode, FiBarChart2, FiServer, FiTrendingUp, FiWifi } from "react-icons/fi";

export const FORMATION_CATEGORIES = [
  { key: "development", icon: FiCode,       labelKey: "landing.categoryDevelopment", slugs: ["mobile-flutter", "fullstack-spring-angular", "mern-stack"] },
  { key: "data",        icon: FiBarChart2,  labelKey: "landing.categoryData",        slugs: ["bi", "ai"] },
  { key: "systeme",     icon: FiServer,     labelKey: "landing.categorySysteme",     slugs: ["devops", "cyber-security"] },
  { key: "iot",         icon: FiWifi,       labelKey: "landing.categoryIot",         slugs: ["iot"] },
  { key: "marketing",   icon: FiTrendingUp, labelKey: "landing.categoryMarketing",   slugs: ["digital-marketing"] },
];

export function getCategoryForSlug(slug) {
  return FORMATION_CATEGORIES.find((c) => c.slugs.includes(slug))?.key || null;
}
