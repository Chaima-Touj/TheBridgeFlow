// Vraies captures d'écran de témoignages — public/images/feedback-thumbs/.
// Chaque carte du carousel affiche l'image telle quelle, aucune donnée
// reconstruite (pas de nom/texte/note séparés).
const FEEDBACK_IMAGE_COUNT = 29;

export const SCREENSHOT_FEEDBACKS = Array.from({ length: FEEDBACK_IMAGE_COUNT }, (_, i) => ({
  id: `feedback-img-${i + 1}`,
  src: `/images/feedback-thumbs/img${i + 1}.jpg`,
}));
