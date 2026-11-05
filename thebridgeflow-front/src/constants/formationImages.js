// Illustrations des cartes formations (Pack PFE + page /formations), servies
// depuis public/images/formations/<slug>.webp (800×500, ratio 16:10).
const FORMATION_IMAGE_SLUGS = new Set([
  "mobile-flutter",
  "fullstack-spring-angular",
  "digital-marketing",
  "bi",
  "ai",
  "iot",
  "devops",
  "mern-stack",
  "cyber-security",
]);

export function getFormationImage(slug) {
  return FORMATION_IMAGE_SLUGS.has(slug) ? `/images/formations/${slug}.webp` : null;
}
