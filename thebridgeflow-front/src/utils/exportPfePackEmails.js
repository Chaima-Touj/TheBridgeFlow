import { jsPDF } from "jspdf";
import { programOf } from "./pfePackAdmin.js";

/* Export PDF des e-mails des demandes Pack PFE / Summer Camp (tableau de bord
   admin). program : "all" (tous les programmes) | "pfe-pack" | "summer-camp".
   Titre et nom de fichier fixes, en français : la police standard de jsPDF
   (Helvetica) ne sait pas écrire l'arabe. */
const EMAIL_EXPORTS = {
  all: { title: "Pack PFE & Summer Camp - adresses e-mail", filename: "inscriptions-pack-pfe-summer-camp-emails.pdf" },
  "pfe-pack": { title: "Pack PFE - adresses e-mail", filename: "inscriptions-pack-pfe-emails.pdf" },
  "summer-camp": { title: "Summer Camp - adresses e-mail", filename: "inscriptions-summer-camp-emails.pdf" },
};

// Titre et nom du fichier pour le programme choisi (valeur inconnue → tous les programmes).
export function getPfePackEmailsExport(program = "all") {
  return EMAIL_EXPORTS[Object.hasOwn(EMAIL_EXPORTS, program) ? program : "all"];
}

// Adresses uniques (sans tenir compte de la casse) des demandes du programme choisi.
export function getPfePackEmails(registrations = [], { program = "all" } = {}) {
  const uniqueEmails = new Map();
  registrations.forEach((registration) => {
    if (program && program !== "all" && programOf(registration) !== program) return;
    const email = registration?.email?.trim();
    const normalizedEmail = email?.toLocaleLowerCase();
    if (email && !uniqueEmails.has(normalizedEmail)) uniqueEmails.set(normalizedEmail, email);
  });
  return [...uniqueEmails.values()];
}

export function buildPfePackEmailsPdf(registrations = [], { program = "all" } = {}) {
  const { title, filename } = getPfePackEmailsExport(program);
  const emails = getPfePackEmails(registrations, { program });
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 26;
  emails.forEach((email) => {
    const lines = doc.splitTextToSize(email, 182);
    if (y + lines.length * 5 > pageHeight - 10) {
      doc.addPage();
      y = 16;
    }
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
  });
  return { doc, emails, title, filename };
}
