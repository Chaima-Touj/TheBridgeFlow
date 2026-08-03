// Construit le tableau weekProgress initial d'une inscription à partir des
// semaines définies sur la formation — semaine 1 déverrouillée (in_progress),
// le reste à not_started. Partagé entre les deux chemins de création d'une
// Enrollment (auto-inscription et acceptation d'une demande par un admin) :
// avant, seul le premier chemin l'appliquait, laissant weekProgress vide (et
// donc la progression affichée à "0/0") pour les inscriptions créées via
// acceptation de demande.
export function buildInitialWeekProgress(weeks = []) {
  const sorted = [...weeks].sort((a, b) => a.week - b.week);
  return sorted.map((w, i) => ({
    weekNumber: w.week,
    status: i === 0 ? "in_progress" : "not_started",
  }));
}
