import assert from "node:assert/strict";
import test from "node:test";
import { buildUsersPDF } from "./exportUsersPDF.js";

const translate = (key, values = {}) => ({
  "adminUsers.pdfTitle": "Liste des utilisateurs",
  "adminUsers.csvColUser": "Nom",
  "adminUsers.csvColEmail": "Email",
  "adminUsers.csvColRole": "Rôle",
  "adminUsers.csvColStatus": "Statut",
  "adminUsers.csvColJoined": "Inscription",
  "adminUsers.roleStudent": "Étudiant",
  "adminUsers.roleAdmin": "Administrateur",
  "adminUsers.statusActive": "Actif",
  "adminUsers.statusInactive": "Inactif",
  "adminUsers.verifiedNo": "Non vérifié",
  "adminFormations.pdfExportedOn": `Exporté le ${values.date}`,
  "adminUsers.emptyExport": "Aucun utilisateur à exporter.",
}[key] || key);

test("users PDF contains actual user rows and handles an empty database result", () => {
  const populatedPdf = buildUsersPDF([
    { name: "Chaima Touj", email: "chaima@example.tn", role: "étudiant", isVerified: true, isActive: true, createdAt: "2026-11-03" },
  ], translate).output();
  assert.match(populatedPdf, /Chaima Touj/);
  assert.match(populatedPdf, /chaima@example\.tn/);
  assert.match(populatedPdf, /Étudiant/);

  const emptyPdf = buildUsersPDF([], translate).output();
  assert.match(emptyPdf, /Aucun utilisateur/);
});
