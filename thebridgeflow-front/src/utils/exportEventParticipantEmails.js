import { jsPDF } from "jspdf";

export function getEventParticipantEmails(registrations) {
  const emailByNormalizedAddress = new Map();
  registrations
    .filter(({ status }) => status === "registered")
    .forEach(({ student }) => {
      const email = student?.email?.trim();
      const normalizedEmail = email?.toLocaleLowerCase();
      if (email && !emailByNormalizedAddress.has(normalizedEmail)) {
        emailByNormalizedAddress.set(normalizedEmail, email);
      }
    });
  return [...emailByNormalizedAddress.values()];
}

export function buildEventParticipantEmailsPdf(event, registrations) {
  const emails = getEventParticipantEmails(registrations);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;
  emails.forEach((email) => {
    const lines = doc.splitTextToSize(email, 182);
    const lineHeight = 5;
    if (y + lines.length * lineHeight > pageHeight - 10) {
      doc.addPage();
      y = 16;
    }
    doc.text(lines, 14, y);
    y += lines.length * lineHeight + 2;
  });

  const safeName = (event.title || "evenement")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || event._id;

  return { doc, emails, filename: `participants-${safeName}.pdf` };
}
