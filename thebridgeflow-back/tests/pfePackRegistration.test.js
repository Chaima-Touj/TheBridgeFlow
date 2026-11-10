import test from "node:test";
import assert from "node:assert/strict";
import { validatePfePackRegistration } from "../utils/validatePfePackRegistration.js";

const validInput = {
  firstName: "  Sara ",
  lastName: " Ben Ali ",
  phone: "+216 20 000 000",
  email: "SARA@example.com",
  university: " Université de Tunis ",
  city: " Tunis ",
  technologies: [" React ", "Node.js", "React"],
  locationMode: "onsite",
  preferredLocation: "LAC1 – Tunis",
  consentConfirmed: true,
  subject: "Application de gestion",
};

test("normalizes a valid Pack PFE request", () => {
  assert.deepEqual(validatePfePackRegistration(validInput), {
    ...validInput,
    firstName: "Sara",
    lastName: "Ben Ali",
    email: "sara@example.com",
    university: "Université de Tunis",
    city: "Tunis",
    technologies: ["React", "Node.js"],
    consentConfirmed: true,
    subject: "Application de gestion",
  });
});

test("rejects malformed or incomplete registration fields", () => {
  for (const input of [
    { ...validInput, firstName: " " },
    { ...validInput, email: "not-an-email" },
    { ...validInput, technologies: [] },
    { ...validInput, technologies: ["React"] },
    { ...validInput, technologies: ["React", "React"] },
    { ...validInput, university: "" },
    { ...validInput, city: "" },
    { ...validInput, locationMode: "onsite", preferredLocation: "" },
    { ...validInput, consentConfirmed: false },
    { ...validInput, subject: "x".repeat(3001) },
  ]) {
    assert.throws(() => validatePfePackRegistration(input), { statusCode: 400 });
  }
});

test("remote requests do not keep an onsite location", () => {
  const result = validatePfePackRegistration({ ...validInput, locationMode: "remote", preferredLocation: "LAC1 – Tunis" });
  assert.equal(result.locationMode, "remote");
  assert.equal(result.preferredLocation, "");
});

test("accepts requests without a PFE subject", () => {
  const { subject, ...inputWithoutSubject } = validInput;
  assert.equal("subject" in validatePfePackRegistration(inputWithoutSubject), false);
});
