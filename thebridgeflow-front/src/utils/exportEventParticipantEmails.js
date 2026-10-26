import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

export function buildEventParticipantEmailsPdf(event, registrations, t, language) {
  const emails = getEventParticipantEmails(registrations);
  const exportedAt = new Date();
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text(t("events.emailsPdfTitle"), 14, 16);
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(event.title || "", 180);
  doc.text(titleLines, 14, 24);
  doc.setFontSize(9);
  const metadataY = 24 + titleLines.length * 5 + 2;
  doc.text(t("events.emailsPdfExportedOn", { date: exportedAt.toLocaleDateString(language) }), 14, metadataY);
  doc.text(t("events.emailsPdfCount", { count: emails.length }), 14, metadataY + 6);

  if (emails.length > 0) {
    autoTable(doc, {
      head: [[t("events.emailsPdfEmailColumn")]],
      body: emails.map((email) => [email]),
      startY: metadataY + 12,
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [30, 64, 175] },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.text(t("events.emailsPdfNoEmails"), 14, metadataY + 16, { maxWidth: 180 });
  }

  const safeName = (event.title || "evenement")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || event._id;

  return { doc, emails, filename: `participants-${safeName}.pdf` };
}
