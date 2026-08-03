import Interview from "../models/interview.model.js";

// Un entretien "proposé"/"confirmé" dont la date est passée n'a pas de statut
// "terminé" automatique côté modèle (rien ne le fait transitionner tout seul).
// Appelé avant toute lecture de la collection Interview afin que la liste
// reflète l'état réel : ni "annulé" (décision explicite, jamais écrasée) ni
// déjà "terminé" ne sont retouchés, seuls les rendez-vous simplement dépassés
// le sont.
export async function autoCompletePastInterviews(filter = {}) {
  await Interview.updateMany(
    { ...filter, scheduledAt: { $lt: new Date() }, status: { $in: ["proposé", "confirmé"] } },
    { $set: { status: "terminé" } }
  );
}
