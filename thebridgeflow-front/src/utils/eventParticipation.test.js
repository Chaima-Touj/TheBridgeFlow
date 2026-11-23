import test from "node:test";
import assert from "node:assert/strict";
import {
  validateParticipationForm, buildParticipationPayload, participationErrorKey, participationErrorField,
  EMPTY_PARTICIPATION_FORM,
} from "./eventParticipation.js";

const valid = {
  firstName: "Sarra", lastName: "Haddad", email: "Sarra@Mail.tn ", phone: "20123456",
  university: "ISET Rades", studyLevel: "bac3", interest: "",
};

test("an empty form reports every required field", () => {
  assert.deepEqual(validateParticipationForm(EMPTY_PARTICIPATION_FORM), {
    firstName: "required", lastName: "required", university: "required",
    email: "required", phone: "required", studyLevel: "required",
  });
});

test("valid form has no error and builds a normalized payload", () => {
  assert.deepEqual(validateParticipationForm(valid), {});
  assert.deepEqual(buildParticipationPayload({ ...valid, interest: "upcoming" }), {
    firstName: "Sarra", lastName: "Haddad", email: "sarra@mail.tn", phone: "+216 20 123 456",
    university: "ISET Rades", studyLevel: "bac3", interest: "upcoming",
  });
});

test("format errors", () => {
  assert.equal(validateParticipationForm({ ...valid, email: "x@y" }).email, "email");
  assert.equal(validateParticipationForm({ ...valid, phone: "1234" }).phone, "phone");
  assert.equal(validateParticipationForm({ ...valid, firstName: "x".repeat(81) }).firstName, "tooLong");
  assert.equal(validateParticipationForm({ ...valid, studyLevel: "master" }).studyLevel, "required");
});

test("email format matches the backend rule", () => {
  for (const email of ["sarra.ben-ali@gmail.com", "a_b+pfe@etud.univ-tunis.tn"]) {
    assert.equal(validateParticipationForm({ ...valid, email }).email, undefined, email);
  }
  for (const email of ["victim@school.tn?bcc=spy%40evil.com", "a@b..tn", "x@y.tn<script>", "a..b@gmail.com", "a@gmail.c"]) {
    assert.equal(validateParticipationForm({ ...valid, email }).email, "email", email);
  }
});

test("server error mapping never exposes raw server text", () => {
  assert.equal(participationErrorKey({ message: "Network Error" }), "network");
  assert.equal(participationErrorKey({ response: { status: 429, data: {} } }), "rateLimited");
  assert.equal(participationErrorKey({ response: { status: 400, data: { code: "EVENT_UNAVAILABLE" } } }), "eventUnavailable");
  assert.equal(participationErrorKey({ response: { status: 400, data: { code: "VALIDATION_ERROR", field: "email" } } }), "fixFields");
  assert.equal(participationErrorKey({ response: { status: 403, data: { message: "Veuillez cocher…" } } }), "captcha");
  assert.equal(participationErrorKey({ response: { status: 500, data: { message: "buffering timed out" } } }), "generic");
  assert.equal(participationErrorKey({ response: { status: 400, data: { message: "x" } } }), "generic");
  assert.equal(participationErrorField({ response: { data: { field: "email" } } }), "email");
  assert.equal(participationErrorField({ response: { data: { field: "__proto__" } } }), null);
});
