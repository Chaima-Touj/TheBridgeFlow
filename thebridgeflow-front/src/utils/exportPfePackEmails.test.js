import test from "node:test";
import assert from "node:assert/strict";
import { getPfePackEmails } from "./exportPfePackEmails.js";

test("exports unique email addresses only", () => {
  assert.deepEqual(getPfePackEmails([
    { email: " sara@example.com ", firstName: "Sara" },
    { email: "SARA@example.com", lastName: "Ben Ali" },
    { email: "yassine@example.com", phone: "+216 20 000 000" },
    { email: "" },
  ]), ["sara@example.com", "yassine@example.com"]);
});
