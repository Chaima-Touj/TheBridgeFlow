/* Adresse e-mail affichée dans une colonne étroite : si elle ne tient pas sur
   une ligne, elle passe à la ligne après « @ » (jamais au milieu d'un mot,
   ex. « gmail.co | m »). Un seul élément <span> : fonctionne aussi dans un
   conteneur en grille. */
export default function BreakableEmail({ email, className }) {
  const value = String(email || "");
  const at = value.lastIndexOf("@");
  if (at <= 0) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </span>
  );
}
