// Isole visuellement le numéro de téléphone (dir="ltr") à l'intérieur d'une
// phrase traduite, sans changer la structure de la clé i18n ni forcer toute
// la phrase en LTR — seul ce span l'est, le reste garde le sens de lecture
// de la langue active. Corrige l'inversion bidi ("064 840 58 216+") observée
// en arabe partout où le numéro apparaît au milieu d'un texte traduit.
export const PHONE_NUMBER = "+216 58 840 064";

export function withIsolatedPhone(text) {
  if (!text || !text.includes(PHONE_NUMBER)) return text;
  const [before, after] = text.split(PHONE_NUMBER);
  return (
    <>
      {before}<span dir="ltr">{PHONE_NUMBER}</span>{after}
    </>
  );
}
