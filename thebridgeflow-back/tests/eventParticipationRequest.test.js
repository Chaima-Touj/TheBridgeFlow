import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEventParticipationRequest, interestKeyOf, escapeRegex, participationDedupKey, STUDY_LEVELS,
} from "../utils/validateEventParticipationRequest.js";

const valid = {
  firstName: "  Sarra ",
  lastName: " Ben   Ali ",
  email: " SARRA@Example.com ",
  phone: "20123456",
  university: " ISET  Rades ",
  studyLevel: "bac3",
};

test("normalizes a valid request and ignores unknown fields", () => {
  const result = validateEventParticipationRequest({ ...valid, status: "confirmed", interest: "", hack: 1 });
  assert.deepEqual(result, {
    firstName: "Sarra",
    lastName: "Ben Ali",
    email: "sarra@example.com",
    phone: "+216 20 123 456",
    university: "ISET Rades",
    studyLevel: "bac3",
    interest: "",
  });
});

test("accepts the upcoming option and an event id", () => {
  assert.equal(validateEventParticipationRequest({ ...valid, interest: "upcoming" }).interest, "upcoming");
  assert.equal(validateEventParticipationRequest({ ...valid, interest: "0123456789abcdef01234567" }).interest, "0123456789abcdef01234567");
  assert.equal(validateEventParticipationRequest({ ...valid, interest: null }).interest, "");
});

test("rejects missing or malformed fields with the field name", () => {
  const cases = [
    [{ ...valid, firstName: " " }, "firstName"],
    [{ ...valid, lastName: undefined }, "lastName"],
    [{ ...valid, email: "pas-un-email" }, "email"],
    [{ ...valid, email: "" }, "email"],
    [{ ...valid, phone: "123" }, "phone"],
    [{ ...valid, phone: "+33 6 12 34 56 78" }, "phone"],
    [{ ...valid, university: "" }, "university"],
    [{ ...valid, university: "x".repeat(161) }, "university"],
    [{ ...valid, studyLevel: "master" }, "studyLevel"],
    [{ ...valid, interest: "../../x" }, "interest"],
    [{ ...valid, interest: { $ne: null } }, "interest"],
    [{ ...valid, firstName: { $gt: "" } }, "firstName"],
  ];
  for (const [input, field] of cases) {
    assert.throws(() => validateEventParticipationRequest(input), (error) => error.statusCode === 400 && error.field === field, field);
  }
  assert.throws(() => validateEventParticipationRequest(null), { statusCode: 400 });
  assert.throws(() => validateEventParticipationRequest([]), { statusCode: 400 });
});

test("email format: accepts usual addresses, rejects mailto injection and malformed domains", () => {
  for (const email of ["sarra.ben-ali@gmail.com", "a_b+pfe@etud.univ-tunis.tn", "X.Y@Sub.Domain.Org"]) {
    assert.doesNotThrow(() => validateEventParticipationRequest({ ...valid, email }), email);
  }
  for (const email of [
    "victim@school.tn?bcc=spy%40evil.com&body=Hi", "a@b..tn", "x@y.tn<script>", "a..b@gmail.com",
    ".a@gmail.com", "a@-gmail.com", "a@gmail", "a b@gmail.com", "\"q\"@gmail.com", "a@gmail.c",
  ]) {
    assert.throws(() => validateEventParticipationRequest({ ...valid, email }), (error) => error.field === "email" && error.code === "VALIDATION_ERROR", email);
  }
});

test("dedup key ignores case, accents and spacing but not the choice or the data", () => {
  const base = validateEventParticipationRequest(valid);
  const key = participationDedupKey(base, "general");
  assert.match(key, /^[a-f\d]{64}$/);
  assert.equal(participationDedupKey({ ...base, firstName: "SARRA", university: "iset   rades" }, "general"), key);
  assert.equal(participationDedupKey({ ...base, firstName: "Sârra" }, "general"), key);
  assert.notEqual(participationDedupKey(base, "upcoming"), key);
  assert.notEqual(participationDedupKey({ ...base, studyLevel: "bac4" }, "general"), key);
  assert.notEqual(participationDedupKey({ ...base, phone: "+216 20 123 457" }, "general"), key);
});

test("helpers", () => {
  assert.equal(interestKeyOf(""), "general");
  assert.equal(interestKeyOf("upcoming"), "upcoming");
  assert.equal(new RegExp(escapeRegex("a.b(")).test("a.b("), true);
  assert.deepEqual(STUDY_LEVELS, ["bac", "bac1", "bac2", "bac3", "bac4", "bac5", "other"]);
});
