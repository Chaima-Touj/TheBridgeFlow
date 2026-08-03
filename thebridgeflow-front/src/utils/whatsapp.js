// Numéro partagé par toutes les icônes/liens WhatsApp du site (Hero, Footer,
// Aide) — construit un lien wa.me avec un message pré-rempli (l'utilisateur
// peut toujours le modifier avant l'envoi, WhatsApp ne l'envoie jamais tout
// seul). Le texte doit être passé déjà traduit (t("common.whatsappPrefill")).
const WHATSAPP_NUMBER = "21658840064";

export function buildWhatsAppLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
