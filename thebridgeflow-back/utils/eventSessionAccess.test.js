import assert from "node:assert/strict";
import test from "node:test";
import { isSafeSessionUrl, isSessionLinkAvailable } from "./eventSessionAccess.js";

const now = new Date("2026-03-01T12:00:00.000Z");
const event = {
  status: "published",
  endsAt: "2026-03-01T11:59:59.000Z",
  sessionUrl: "https://meet.example.com/session",
};

test("session links become available only at or after endsAt", () => {
  assert.equal(isSessionLinkAvailable({ ...event, endsAt: "2026-03-01T12:00:01.000Z" }, now), false);
  assert.equal(isSessionLinkAvailable(event, now), true);
  assert.equal(isSessionLinkAvailable({ ...event, endsAt: null }, now), false);
});

test("session links are only available for published events with HTTPS URLs", () => {
  assert.equal(isSessionLinkAvailable({ ...event, status: "cancelled" }, now), false);
  assert.equal(isSessionLinkAvailable({ ...event, sessionUrl: "http://meet.example.com" }, now), false);
  assert.equal(isSafeSessionUrl("https://user:pass@meet.example.com"), false);
  assert.equal(isSafeSessionUrl("https://meet.example.com/session"), true);
});
