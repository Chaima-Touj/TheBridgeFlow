import assert from "node:assert/strict";
import test from "node:test";
import { getEventPeriodFilter } from "./eventPeriodFilter.js";

const now = new Date("2026-03-01T12:00:00.000Z");

test("upcoming events include in-progress events until their end time", () => {
  assert.deepEqual(getEventPeriodFilter("upcoming", now), {
    $or: [
      { endsAt: { $gte: now } },
      { endsAt: null, startsAt: { $gte: now } },
    ],
  });
});

test("past events are classified by end time, falling back to start time", () => {
  assert.deepEqual(getEventPeriodFilter("past", now), {
    $or: [
      { endsAt: { $lt: now } },
      { endsAt: null, startsAt: { $lt: now } },
    ],
  });
});
