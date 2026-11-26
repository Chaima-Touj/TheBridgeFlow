import { BRAND_PREFIX, BRAND_ACCENT } from "../../constants/brand.js";

/**
 * Logo texte bicolore de la plateforme : « 9antra.tn » + « _the_bridge »
 * dans la couleur d'accent propre à chaque logo (accentClassName : chaque
 * logo garde son style d'accent actuel — couleur, dégradé, opacité...).
 *
 * - dir="ltr" isole le nom (latin) dans les pages en arabe (RTL) : l'ordre
 *   des caractères ne change jamais, quel que soit le texte autour.
 * - translate="no" : les outils de traduction du navigateur ne doivent pas
 *   traduire un nom propre.
 * - <wbr> : seul point de coupure possible, utilisé uniquement si un
 *   conteneur sans `white-space: nowrap` devient trop étroit (le nom passe
 *   alors sur deux lignes au lieu de déborder). Les logos sont en nowrap :
 *   ils ne coupent jamais.
 */
export default function BrandName({ className, accentClassName }) {
  return (
    <span className={className} dir="ltr" translate="no">
      {BRAND_PREFIX}<wbr />
      <span className={accentClassName}>{BRAND_ACCENT}</span>
    </span>
  );
}
