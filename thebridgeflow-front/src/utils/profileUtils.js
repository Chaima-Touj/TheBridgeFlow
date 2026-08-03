/**
 * Calcule le pourcentage de complétion du profil.
 * Source de vérité unique — importée partout dans l'application.
 * 7 critères, chacun vaut ~14%.
 */
export function computeCompletion(user) {
  if (!user) return 0;
  const checks = [
    !!user.bio,
    (user.skills?.length || 0) > 0,
    !!user.cv?.fileUrl,
    !!user.education?.institution,
    (user.experience?.length || 0) > 0,
    !!user.socialLinks?.linkedin,
    !!user.phone,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
