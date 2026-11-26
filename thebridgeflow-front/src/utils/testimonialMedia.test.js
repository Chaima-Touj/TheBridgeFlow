import test from "node:test";
import assert from "node:assert/strict";
import { apiOrigin, isUploadedMedia, resolveMediaUrl, toTestimonialItem } from "./testimonialMedia.js";

test("API origin is derived from VITE_API_URL", () => {
  assert.equal(apiOrigin("https://9antra.tn/api"), "https://9antra.tn");
  assert.equal(apiOrigin("https://9antra.tn/api/"), "https://9antra.tn");
  assert.equal(apiOrigin("http://localhost:5000/api"), "http://localhost:5000");
  assert.equal(apiOrigin("/api"), "");
});

test("only uploaded videos are prefixed with the API origin", () => {
  const uploaded = "/uploads/testimonials/6f1f8a2e-3b4c-4d5e-8f60-718293a4b5c6.mp4";
  assert.equal(isUploadedMedia(uploaded), true);
  assert.equal(resolveMediaUrl(uploaded, "https://9antra.tn/api"), `https://9antra.tn${uploaded}`);
  assert.equal(resolveMediaUrl(uploaded, "/api"), uploaded);
  const drive = "https://drive.google.com/file/d/abc/preview";
  assert.equal(isUploadedMedia(drive), false);
  assert.equal(resolveMediaUrl(drive, "https://9antra.tn/api"), drive);
  assert.equal(resolveMediaUrl("", "https://9antra.tn/api"), "");
  assert.equal(resolveMediaUrl(undefined, "https://9antra.tn/api"), undefined);
});

test("testimonial item for the carousel", () => {
  const apiUrl = "https://9antra.tn/api";
  assert.deepEqual(
    toTestimonialItem({ _id: "1", url: "/uploads/testimonials/a.mp4", thumbnail: "data:image/jpeg;base64,xx", category: "pfe" }, { apiUrl }),
    { id: "1", videoUrl: "https://9antra.tn/uploads/testimonials/a.mp4", posterUrl: "data:image/jpeg;base64,xx", category: "pfe" },
  );
  assert.equal(toTestimonialItem({ _id: "2", url: "https://drive.google.com/file/d/x/preview", category: "formation" }, { apiUrl }).videoUrl, "https://drive.google.com/file/d/x/preview");
});

test("usable directly in .map() (the index is not taken for the API address)", () => {
  const items = [{ _id: "1", url: "/uploads/testimonials/a.mp4" }, { _id: "2", url: "/uploads/testimonials/b.mp4" }].map(toTestimonialItem);
  // Hors Vite (tests Node) : adresse locale par défaut, jamais « 0/uploads/… » ou « 1/uploads/… ».
  assert.deepEqual(items.map((item) => item.videoUrl), [
    "http://localhost:5000/uploads/testimonials/a.mp4",
    "http://localhost:5000/uploads/testimonials/b.mp4",
  ]);
});
