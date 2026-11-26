// Pages publiques « programme » servies par le même composant PfePackPage :
// même mise en page, même formulaire et même endpoint (pfePackService.register,
// champ `program`). Seuls changent les textes propres au programme (espace i18n
// `textNamespace`, les libellés du formulaire restent partagés dans pfePack.*),
// la carte de code du hero et les témoignages vidéo affichés.
import { getFeaturedFormationTestimonials, getFeaturedPfeTestimonials, getFeaturedSummerCampTestimonials } from "./testimonials.js";
import { BRAND_NAME } from "./brand.js";

// Commentaire en tête de la carte de code : « // 9ANTRA.TN / PACK PFE ».
const CODE_BANNER_BRAND = BRAND_NAME.toUpperCase();

export const DEFAULT_PROGRAM = "pfe-pack";

export const PROGRAM_PAGES = {
  "pfe-pack": {
    textNamespace: "pfePack",
    testimonialsId: "pfe-testimonials",
    // Témoignages fixes de constants/testimonials.js (inchangés sur la page Pack PFE).
    adminTestimonials: false,
    testimonialGroups: [
      { category: "pfe", titleKey: "pfePack.testimonialsTitle", subtitleKey: "pfePack.testimonialsDescription", fallback: getFeaturedPfeTestimonials },
    ],
    code: { file: "PFE.js", banner: `${CODE_BANNER_BRAND} / PACK PFE`, condition: "hasSujetPFE" },
  },
  "summer-camp": {
    textNamespace: "summerCamp",
    testimonialsId: "summer-camp-testimonials",
    // Vidéos gérées par l'admin (SiteSettings.testimonialVideos), comme sur la
    // page d'accueil ; `fallback` sert uniquement si la requête échoue.
    adminTestimonials: true,
    testimonialGroups: [
      { category: "formation", titleKey: "landing.testiFormationTitle", subtitleKey: "landing.testiFormationSub", fallback: getFeaturedFormationTestimonials },
      { category: "summer-camp", titleKey: "landing.testiSummerCampTitle", subtitleKey: "landing.testiSummerCampSub", fallback: getFeaturedSummerCampTestimonials },
    ],
    code: { file: "SummerCamp.js", banner: `${CODE_BANNER_BRAND} / SUMMER CAMP`, condition: "hasExperience" },
  },
};
