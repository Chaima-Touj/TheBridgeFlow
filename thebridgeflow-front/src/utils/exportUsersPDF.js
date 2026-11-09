import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const ROLE_KEY = { étudiant: "adminUsers.roleStudent", admin: "adminUsers.roleAdmin" };
const formatDate = (value) => value ? new Date(value).toLocaleDateString("fr-FR") : "—";

export function buildUsersPDF(rows, t, emailsOnly = false) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(t("adminUsers.pdfTitle"), 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(t("adminFormations.pdfExportedOn", { date: new Date().toLocaleDateString("fr-FR") }), 14, 21);

  const head = emailsOnly
    ? [t("adminUsers.csvColEmail")]
    : ["csvColUser", "csvColEmail", "csvColRole", "csvColStatus", "csvColJoined"]
      .map((key) => t(`adminUsers.${key}`));
  const body = rows.map((user) => emailsOnly ? [user.email || ""] : [
    user.name || "",
    user.email || "",
    t(ROLE_KEY[user.role] || user.role),
    !user.isVerified ? t("adminUsers.verifiedNo") : user.isActive === true ? t("adminUsers.statusActive") : t("adminUsers.statusInactive"),
    formatDate(user.createdAt),
  ]);

  autoTable(doc, {
    head: [head], body, startY: 27, theme: "striped",
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  if (rows.length === 0) doc.text(t("adminUsers.emptyExport", { defaultValue: "Aucun utilisateur à exporter." }), 14, 38);
  return doc;
}

export function exportUsersPDF(rows, t, emailsOnly = false) {
  const doc = buildUsersPDF(rows, t, emailsOnly);
  doc.save(`${emailsOnly ? "emails" : "utilisateurs"}-thebridgeflow-${new Date().toISOString().slice(0, 10)}.pdf`);
  return doc;
}
