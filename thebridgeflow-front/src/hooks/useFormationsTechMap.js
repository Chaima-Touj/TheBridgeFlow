import { useEffect, useState } from "react";
import { formationsService } from "../services/formations.service.js";

// Liste allégée des formations (slug, title, technologies), utilisée pour
// faire correspondre les tags de compétences d'une offre à la formation qui
// les enseigne. Chargée une fois par page — 9 formations, payload minime.
export function useFormationsTechMap() {
  const [formations, setFormations] = useState([]);

  useEffect(() => {
    let active = true;
    formationsService.getTechMap()
      .then(({ data }) => { if (active) setFormations(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setFormations([]); });
    return () => { active = false; };
  }, []);

  return formations;
}
