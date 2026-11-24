import test from "node:test";
import assert from "node:assert/strict";
import {
  EMAIL_PATTERN, PARTICIPATION_STATUSES, UPCOMING_INTEREST, escapeRegex,
} from "../utils/validateEventParticipationRequest.js";
import { REQUEST_STATUSES } from "../utils/requestStatuses.js";

test("email pattern: accepts usual addresses, rejects mailto injection and malformed domains", () => {
  for (const email of ["sarra.ben-ali@gmail.com", "a_b+pfe@etud.univ-tunis.tn", "X.Y@Sub.Domain.Org"]) {
    assert.equal(EMAIL_PATTERN.test(email), true, email);
  }
  for (const email of [
    "victim@school.tn?bcc=spy%40evil.com&body=Hi", "a@b..tn", "x@y.tn<script>", "a..b@gmail.com",
    ".a@gmail.com", "a@-gmail.com", "a@gmail", "a b@gmail.com", "\"q\"@gmail.com", "a@gmail.c",
  ]) {
    assert.equal(EMAIL_PATTERN.test(email), false, email);
  }
});

test("helpers and shared constants", () => {
  assert.equal(new RegExp(escapeRegex("a.b(")).test("a.b("), true);
  assert.equal(new RegExp(`^${escapeRegex("a+b")}$`).test("aab"), false);
  assert.deepEqual(PARTICIPATION_STATUSES, REQUEST_STATUSES);
  assert.equal(UPCOMING_INTEREST, "upcoming");
});
