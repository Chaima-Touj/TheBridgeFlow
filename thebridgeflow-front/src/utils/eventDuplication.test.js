import assert from "node:assert/strict";
import test from "node:test";
import { buildEventDuplicateDraft } from "./eventDuplication.js";

test("event duplication keeps reusable fields and excludes operational or identity data", () => {
  const draft = buildEventDuplicateDraft({
    _id: "event-id",
    title: "Meetup",
    description: "Description",
    image: "https://example.com/image.jpg",
    category: "Workshop",
    startsAt: "2026-03-01T10:00:00Z",
    endsAt: "2026-03-01T11:00:00Z",
    timezone: "Africa/Tunis",
    mode: "online",
    location: "",
    meetingUrl: "https://old-meeting.example",
    sessionUrl: "https://old-session.example",
    capacity: 30,
    registrationRequired: true,
    registrationCount: 19,
    status: "published",
  }, "copy");

  assert.equal(draft.title, "Meetup (copy)");
  assert.equal(draft.status, "draft");
  assert.equal(draft.capacity, 30);
  assert.equal("meetingUrl" in draft, false);
  assert.equal("sessionUrl" in draft, false);
  assert.equal("registrationCount" in draft, false);
  assert.equal("_id" in draft, false);
});
