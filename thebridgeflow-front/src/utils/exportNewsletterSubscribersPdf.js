import { jsPDF } from "jspdf";
export function buildNewsletterSubscribersPdf(subscribers) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(11);
  const emails = subscribers.map(({ email }) => email).filter(Boolean);
  const linesPerPage = 48;
  emails.forEach((email, index) => {
    if (index > 0 && index % linesPerPage === 0) doc.addPage();
    doc.text(String(email), 14, 16 + (index % linesPerPage) * 5.5);
  });
  return doc;
}
