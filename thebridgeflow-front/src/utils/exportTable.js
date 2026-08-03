import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Échappe une valeur pour un champ CSV (guillemets, virgules, retours ligne).
export function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Les polices intégrées de jsPDF (Helvetica) utilisent l'encodage WinAnsi —
// les accents français et les tirets em/en passent très bien, mais les
// flèches (ex. "→" dans certains libellés UI) en sortent et cassent le rendu
// de toute la chaîne. On les remplace par un équivalent ASCII plutôt que de
// changer les libellés UI (corrects en HTML).
const PDF_UNSAFE_CHARS = { "→": "->", "←": "<-", "↔": "<->" };
export function pdfSafe(value) {
  const s = String(value ?? "");
  return s.replace(/[→←↔]/g, (c) => PDF_UNSAFE_CHARS[c] || c);
}

// Génère et télécharge un CSV à partir d'en-têtes + lignes.
export function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Écrit le titre + la date d'export en haut d'un document jsPDF — commun à
// tous les exports admin (cohérence visuelle entre pages).
export function writePdfHeader(doc, title, dateLabel) {
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe(title), 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfSafe(dateLabel), 14, 21);
}

// Table autoTable stylée de façon cohérente avec le reste du dashboard admin.
export function writePdfTable(doc, { head, body, startY }) {
  autoTable(doc, {
    head: [head.map(pdfSafe)],
    body: body.map((row) => row.map(pdfSafe)),
    startY,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  return doc.lastAutoTable.finalY;
}

// Génère, remplit et télécharge un PDF à table unique — le cas courant
// (une page = une liste). Les pages à plusieurs tables (ex. Statistiques)
// composent directement writePdfHeader/writePdfTable.
export function exportSingleTablePDF({ filename, title, dateLabel, head, body, orientation }) {
  const doc = new jsPDF({
    orientation: orientation || (head.length > 4 ? "landscape" : "portrait"),
    unit: "mm",
    format: "a4",
  });
  writePdfHeader(doc, title, dateLabel);
  writePdfTable(doc, { head, body, startY: 27 });
  doc.save(filename);
}
