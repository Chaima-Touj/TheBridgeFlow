const CONTEXT_STOP_WORDS = new Set([
  "quel", "quelle", "quels", "quelles", "comment", "combien", "pourquoi", "pour", "avec", "dans", "sur", "chez",
  "est", "sont", "des", "une", "les", "aux", "mon", "ma", "mes", "moi", "vous", "notre", "cette", "cela",
  "donne", "donner", "cherche", "chercher", "montre", "voir", "trouve", "trouver", "information", "informations",
  "stage", "stages", "offre", "offres", "pfe", "formation", "formations", "event", "events", "evenement", "evenements",
  "événement", "événements", "tarif", "tarifs", "prix", "durée", "duree", "modalité", "modalités", "disponible", "disponibles",
  "internship", "internships", "offer", "offers", "training", "trainings", "event", "events", "price", "prices", "duration",
]);

export function getContextSearchTerms(question) {
  const words = String(question).toLocaleLowerCase("fr").match(/[\p{L}\p{N}]{3,}/gu) || [];
  return [...new Set(words.filter((word) => !CONTEXT_STOP_WORDS.has(word)))].slice(0, 4);
}

export function buildFieldSearch(terms, fields) {
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return {
    $and: escaped.map((term) => ({
      $or: fields.map((field) => ({ [field]: { $regex: term, $options: "i" } })),
    })),
  };
}
