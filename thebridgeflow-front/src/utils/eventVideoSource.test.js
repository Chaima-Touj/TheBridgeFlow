import assert from "node:assert/strict";
import test from "node:test";
import { getEventVideoSource } from "./eventVideoSource.js";

test("maps YouTube and Vimeo links to privacy-aware embeds", () => {
  assert.deepEqual(getEventVideoSource("https://youtu.be/example-id"), {
    type: "embed",
    src: "https://www.youtube-nocookie.com/embed/example-id",
  });
  assert.deepEqual(getEventVideoSource("https://vimeo.com/123456"), {
    type: "embed",
    src: "https://player.vimeo.com/video/123456",
  });
});

test("plays video files in a native player and resolves other supported links", () => {
  assert.deepEqual(getEventVideoSource("https://cdn.example.com/session.mp4"), {
    type: "video",
    src: "https://cdn.example.com/session.mp4",
  });
  assert.equal(getEventVideoSource("https://drive.google.com/file/d/example/view").type, "embed");
});
