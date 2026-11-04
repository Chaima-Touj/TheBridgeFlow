import test from "node:test";
import assert from "node:assert/strict";
import { validatePfePackRegistration } from "../utils/validatePfePackRegistration.js";

const validInput = {
  firstName: "  Sara ",
  lastName: " Ben Ali ",
  phone: "+216 20 000 000",
  email: "SARA@example.com",
  technologies: [" React ", "Node.js", "React"],
  subject: "Application de gestion",
};

test("normalizes a valid Pack PFE request", () => {
  assert.deepEqual(validatePfePackRegistration(validInput), {
    ...validInput,
    firstName: "Sara",
    lastName: "Ben Ali",
    email: "sara@example.com",
    technologies: ["React", "Node.js"],
    subject: "Application de gestion",
  });
});

test("rejects malformed or incomplete registration fields", () => {
  for (const input of [
    { ...validInput, firstName: " " },
    { ...validInput, email: "not-an-email" },
    { ...validInput, technologies: [] },
    { ...validInput, subject: "x".repeat(3001) },
  ]) {
    assert.throws(() => validatePfePackRegistration(input), { statusCode: 400 });
  }
});
