import test from "node:test";
import assert from "node:assert/strict";
import {
  applyStatusUpdate, countByProgram, countByStatus, filterRegistrations, groupTechnologies, initials, mailtoHref,
  normalizeProgramFilter, normalizeSearchText, programOf, registrationStatus, splitTechnology, telHref,
} from "./pfePackAdmin.js";

const registrations = [
  {
    _id: "a",
    firstName: "Sara",
    lastName: "Ben Ali",
    email: "sara@example.com",
    phone: "+216 29 324 873",
    university: "Université de Tunis El Manar",
    city: "Tunis",
    technologies: ["Artificial Intelligence (AI Chatbot / Système de recommandation)", "DevOps"],
    program: "summer-camp",
    status: "contacted",
  },
  {
    _id: "b",
    firstName: "Yassine",
    lastName: "Trabelsi",
    email: "yassine@example.com",
    phone: "20123456",
    university: "ISET Radès",
    city: "Ben Arous",
    technologies: ["Cyber Security", "MERN Stack Development (React + Node)"],
    // Demande enregistrée avant l'ajout du suivi et du programme : ni statut ni programme.
  },
  {
    _id: "c",
    firstName: "Émna",
    lastName: "Chérif",
    email: "emna@example.com",
    phone: "+216 55 000 111",
    university: "ENIS",
    city: "Sfax",
    technologies: ["Business Intelligence (BI)", "Internet of Things (IoT)"],
    program: "pfe-pack",
    status: "confirmed",
  },
  { _id: "d", firstName: "Ali", lastName: "Kefi", email: "ali@example.com", phone: "", university: "", city: "", technologies: [], program: "bootcamp", status: "archived" },
];
const ids = (list) => list.map((item) => item._id);

test("a missing or unknown status counts as new", () => {
  assert.equal(registrationStatus(registrations[1]), "new");
  assert.equal(registrationStatus(registrations[3]), "new");
  assert.equal(registrationStatus(null), "new");
  assert.equal(registrationStatus(registrations[0]), "contacted");
});

test("countByStatus counts every request once", () => {
  assert.deepEqual(countByStatus(registrations), { all: 4, new: 2, contacted: 1, confirmed: 1 });
  assert.deepEqual(countByStatus([]), { all: 0, new: 0, contacted: 0, confirmed: 0 });
  assert.deepEqual(countByStatus(), { all: 0, new: 0, contacted: 0, confirmed: 0 });
});

test("filterRegistrations filters by normalised status", () => {
  assert.deepEqual(ids(filterRegistrations(registrations, { status: "all" })), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(filterRegistrations(registrations, {})), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { status: "new" })), ["b", "d"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { status: "contacted" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { status: "confirmed" })), ["c"]);
});

test("search matches first and last name in any order, ignoring case and accents", () => {
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "sara ben ali" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "Ali  Ben   SARA" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "emna cherif" })), ["c"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "ÉMNA" })), ["c"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "   " })), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "nobody" })), []);
});

test("search covers email, university, city and technologies", () => {
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "yassine@example" })), ["b"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "universite tunis" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "rades" })), ["b"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "sfax" })), ["c"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "systeme de recommandation" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "devops" })), ["a"]);
  // « Ben » : nom de famille de Sara et ville de Yassine (Ben Arous).
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "ben" })), ["a", "b"]);
});

test("a phone number typed without spaces or with the country code matches the stored number", () => {
  for (const search of ["29324873", "29 324 873", "+216 29324873", "21629324873", "0021629324873", "324873"]) {
    assert.deepEqual(ids(filterRegistrations(registrations, { search })), ["a"], search);
  }
  // Numéro enregistré sans indicatif.
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "+216 20 123 456" })), ["b"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "20 12" })), ["b"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "99999999" })), []);
});

test("search and status filters combine", () => {
  assert.deepEqual(ids(filterRegistrations(registrations, { status: "new", search: "ben" })), ["b"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { status: "confirmed", search: "ben" })), []);
});

test("a missing or unknown program counts as PFE Pack", () => {
  assert.equal(programOf(registrations[0]), "summer-camp");
  assert.equal(programOf(registrations[1]), "pfe-pack");
  assert.equal(programOf(registrations[2]), "pfe-pack");
  assert.equal(programOf(registrations[3]), "pfe-pack");
  assert.equal(programOf(null), "pfe-pack");
});

test("normalizeProgramFilter only keeps the two programs, anything else shows all", () => {
  assert.equal(normalizeProgramFilter("summer-camp"), "summer-camp");
  assert.equal(normalizeProgramFilter("pfe-pack"), "pfe-pack");
  for (const value of [null, undefined, "", "all", "Summer-Camp", "bootcamp", ["summer-camp"]]) {
    assert.equal(normalizeProgramFilter(value), "all", JSON.stringify(value));
  }
});

test("countByProgram counts every request once, old requests as PFE Pack", () => {
  assert.deepEqual(countByProgram(registrations), { all: 4, "pfe-pack": 3, "summer-camp": 1 });
  assert.deepEqual(countByProgram([]), { all: 0, "pfe-pack": 0, "summer-camp": 0 });
  assert.deepEqual(countByProgram(), { all: 0, "pfe-pack": 0, "summer-camp": 0 });
});

test("countByStatus counts the statuses inside the selected program", () => {
  assert.deepEqual(countByStatus(registrations, { program: "all" }), { all: 4, new: 2, contacted: 1, confirmed: 1 });
  assert.deepEqual(countByStatus(registrations, { program: "pfe-pack" }), { all: 3, new: 2, contacted: 0, confirmed: 1 });
  assert.deepEqual(countByStatus(registrations, { program: "summer-camp" }), { all: 1, new: 0, contacted: 1, confirmed: 0 });
});

test("filterRegistrations filters by program, then status and search", () => {
  assert.deepEqual(ids(filterRegistrations(registrations, { program: "all" })), ["a", "b", "c", "d"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { program: "summer-camp" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { program: "pfe-pack" })), ["b", "c", "d"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { program: "pfe-pack", status: "new", search: "ben" })), ["b"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { program: "summer-camp", search: "ben" })), ["a"]);
  assert.deepEqual(ids(filterRegistrations(registrations, { program: "summer-camp", status: "new" })), []);
  // Le programme ne fait pas partie de la recherche.
  assert.deepEqual(ids(filterRegistrations(registrations, { search: "summer" })), []);
});

test("normalizeSearchText removes accents and extra spaces", () => {
  assert.equal(normalizeSearchText("  Système   de  RECOMMANDATION "), "systeme de recommandation");
  assert.equal(normalizeSearchText(null), "");
});

test("splitTechnology separates the main name from its detail", () => {
  assert.deepEqual(splitTechnology("Business Intelligence (BI)"), { name: "Business Intelligence", detail: "BI" });
  assert.deepEqual(splitTechnology("Mobile Development (Flutter + Node/Spring Boot)"), { name: "Mobile Development", detail: "Flutter + Node/Spring Boot" });
  assert.deepEqual(splitTechnology("  DevOps "), { name: "DevOps", detail: "" });
  assert.deepEqual(splitTechnology("Data (Python (Pandas))"), { name: "Data", detail: "Python (Pandas)" });
  assert.deepEqual(splitTechnology("Web () "), { name: "Web", detail: "" });
  // Parenthèses non équilibrées ou sans nom principal : texte gardé tel quel.
  assert.deepEqual(splitTechnology("A (b) (c"), { name: "A (b) (c", detail: "" });
  assert.deepEqual(splitTechnology("(React)"), { name: "(React)", detail: "" });
});

test("groupTechnologies merges entries with the same main name and keeps their order", () => {
  assert.deepEqual(groupTechnologies([
    "Artificial Intelligence (AI Chatbot / Système de recommandation)",
    "DevOps",
    "Artificial Intelligence (IA Chatbot)",
    "Internet of Things (IoT)",
    "artificial intelligence (ia chatbot)",
    "devops",
    "",
  ]), [
    { name: "Artificial Intelligence", details: ["AI Chatbot / Système de recommandation", "IA Chatbot"] },
    { name: "DevOps", details: [] },
    { name: "Internet of Things", details: ["IoT"] },
  ]);
  assert.deepEqual(groupTechnologies(undefined), []);
  assert.deepEqual(groupTechnologies("React"), []);
});

test("applyStatusUpdate updates only the changed request", () => {
  const updated = { _id: "b", status: "confirmed", statusUpdatedAt: "2026-11-24T10:00:00.000Z", statusUpdatedBy: { _id: "u1", name: "Admin" }, subject: "x" };
  const result = applyStatusUpdate(registrations, updated);
  assert.equal(result[1].status, "confirmed");
  assert.equal(result[1].statusUpdatedAt, "2026-11-24T10:00:00.000Z");
  assert.deepEqual(result[1].statusUpdatedBy, { _id: "u1", name: "Admin" });
  assert.equal(result[1].email, "yassine@example.com");
  assert.equal(programOf(result[1]), "pfe-pack");
  assert.equal(applyStatusUpdate(registrations, { _id: "a", status: "new" })[0].program, "summer-camp");
  assert.equal(result[0], registrations[0]);
  assert.equal(registrations[1].status, undefined);
  assert.deepEqual(countByStatus(result), { all: 4, new: 1, contacted: 1, confirmed: 2 });
  assert.equal(applyStatusUpdate(registrations, null), registrations);
});

test("contact helpers build safe links and initials", () => {
  assert.equal(initials(" sara ", "ben ali"), "SB");
  assert.equal(initials("Émna", ""), "É");
  assert.equal(initials(undefined, undefined), "");
  assert.equal(telHref("+216 29 324 873"), "tel:+21629324873");
  assert.equal(telHref("(+216) 29-324-873"), "tel:+21629324873");
  assert.equal(mailtoHref(" sara@example.com "), "mailto:sara@example.com");
  assert.equal(mailtoHref("a@b.tn?cc=x@y.tn&body=hi"), "mailto:a@b.tn%3Fcc%3Dx@y.tn%26body%3Dhi");
});
