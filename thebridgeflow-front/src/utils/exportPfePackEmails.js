import { jsPDF } from "jspdf";

export function getPfePackEmails(registrations) {
  const uniqueEmails = new Map();
  registrations.forEach((registration) => {
    const email = registration?.email?.trim();
    const normalizedEmail = email?.toLocaleLowerCase();
    if (email && !uniqueEmails.has(normalizedEmail)) uniqueEmails.set(normalizedEmail, email);
  });
  return [...uniqueEmails.values()];
}

export function buildPfePackEmailsPdf(registrations) {
  const emails = getPfePackEmails(registrations);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;
  emails.forEach((email) => {
    const lines = doc.splitTextToSize(email, 182);
    if (y + lines.length * 5 > pageHeight - 10) {
      doc.addPage();
      y = 16;
    }
    doc.text(lines, 14, y);
    y += lines.length * 5 + 2;
  });
  return { doc, emails, filename: "inscriptions-pack-pfe-emails.pdf" };
}
