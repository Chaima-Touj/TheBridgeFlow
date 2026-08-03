import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FiDownload, FiChevronDown } from "react-icons/fi";

/**
 * Menu déroulant "Exporter" (PDF + CSV optionnel) — utilisé sur toutes les
 * pages admin listant des données tabulaires (Utilisateurs, Formations,
 * Demandes d'inscription, Inscriptions, Candidatures...). Les classes af-*
 * viennent de AdminFormations.css, déjà importé par ces pages.
 */
export default function ExportMenu({ onExportPDF, onExportCSV }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="af-export-menu" ref={ref}>
      <button type="button" className="af-toolbar-btn" onClick={() => setOpen((v) => !v)}>
        <FiDownload size={14} /> {t("adminFormations.export")} <FiChevronDown size={12} />
      </button>
      {open && (
        <div className="af-row-menu-dropdown af-export-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onExportPDF(); }}>
            {t("adminFormations.exportPdf")}
          </button>
          {onExportCSV && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onExportCSV(); }}>
              {t("adminFormations.exportCsv")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
