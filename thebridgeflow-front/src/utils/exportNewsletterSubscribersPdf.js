import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function buildNewsletterSubscribersPdf(subscribers, t, language) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const exportedAt = new Date();
  doc.setFontSize(16);
  doc.text(t("adminNewsletter.pdfTitle"), 14, 16);
  doc.setFontSize(9);
  doc.text(t("adminNewsletter.pdfExportedOn", { date: exportedAt.toLocaleDateString(language) }), 14, 24);
  doc.text(t("adminNewsletter.pdfCount", { count: subscribers.length }), 14, 30);
  autoTable(doc, {
    head: [[t("adminNewsletter.email"), t("adminNewsletter.subscribedAt")]],
    body: subscribers.map(({ email, subscribedAt }) => [
      email,
      subscribedAt ? new Date(subscribedAt).toLocaleDateString(language) : "—",
    ]),
    startY: 36,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [30, 64, 175] },
    margin: { left: 14, right: 14 },
  });
  return doc;
}
