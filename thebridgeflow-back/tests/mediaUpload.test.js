import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createMediaStore, MAX_VIDEO_BYTES, looksLikeVideo } from "../services/mediaUpload.service.js";

// Début de fichier MP4 valide (boîte « ftyp ») suivi de données quelconques.
const mp4Bytes = (size) => {
  const buffer = Buffer.alloc(size, 7);
  buffer.writeUInt32BE(24, 0);
  buffer.write("ftypisom", 4, "latin1");
  return buffer;
};

async function newStore(options = {}) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "media-upload-test-"));
  return createMediaStore({ root, ...options });
}

test("start refuses unsupported formats, empty and oversized files", async () => {
  const store = await newStore();
  await assert.rejects(store.start({ fileName: "cv.pdf", size: 10 }), { statusCode: 400 });
  await assert.rejects(store.start({ fileName: "video.mp4", size: 0 }), { statusCode: 400 });
  await assert.rejects(store.start({ fileName: "video.mp4", size: "abc" }), { statusCode: 400 });
  await assert.rejects(store.start({ fileName: "video.mp4", size: MAX_VIDEO_BYTES + 1 }), { statusCode: 413 });
  const started = await store.start({ fileName: "Témoignage Final.MP4", size: 30 });
  assert.match(started.uploadId, /^[0-9a-f-]{36}$/);
  assert.equal(started.chunkSize, 8 * 1024 * 1024);
});

test("a video sent in chunks is published under /uploads/testimonials", async () => {
  const store = await newStore();
  const bytes = mp4Bytes(25);
  const { uploadId } = await store.start({ fileName: "clip.mp4", size: bytes.length });
  assert.deepEqual(await store.appendChunk(uploadId, 0, bytes.subarray(0, 10)), { done: false, received: 10 });
  assert.deepEqual(await store.appendChunk(uploadId, 10, bytes.subarray(10, 20)), { done: false, received: 20 });
  const last = await store.appendChunk(uploadId, 20, bytes.subarray(20));
  assert.equal(last.done, true);
  assert.equal(last.url, `/uploads/testimonials/${uploadId}.mp4`);
  assert.deepEqual(await fsp.readFile(path.join(store.videosDir, `${uploadId}.mp4`)), bytes);
  assert.equal(await store.storedVideoExists(last.url), true);
  // Plus de fichier temporaire, et l'envoi terminé n'accepte plus de morceau.
  assert.deepEqual(await fsp.readdir(store.partsDir), []);
  await assert.rejects(store.appendChunk(uploadId, 25, Buffer.from("x")), { statusCode: 404 });
});

test("a lost response to the last chunk: resending it confirms the published video", async () => {
  const store = await newStore();
  const bytes = mp4Bytes(20);
  const { uploadId } = await store.start({ fileName: "clip.mp4", size: bytes.length });
  await store.appendChunk(uploadId, 0, bytes.subarray(0, 12));
  const first = await store.appendChunk(uploadId, 12, bytes.subarray(12));
  const again = await store.appendChunk(uploadId, 12, bytes.subarray(12));
  assert.deepEqual(again, first);
  // Mauvaise position ou mauvaise taille : toujours « introuvable ».
  await assert.rejects(store.appendChunk(uploadId, 0, bytes.subarray(12)), { statusCode: 404 });
});

test("a chunk at an unexpected position answers 409 with the received size (resume)", async () => {
  const store = await newStore();
  const bytes = mp4Bytes(20);
  const { uploadId } = await store.start({ fileName: "clip.mov", size: bytes.length });
  await store.appendChunk(uploadId, 0, bytes.subarray(0, 8));
  await assert.rejects(store.appendChunk(uploadId, 0, bytes.subarray(0, 8)), (error) => error.statusCode === 409 && error.received === 8);
  await assert.rejects(store.appendChunk(uploadId, 12, bytes.subarray(12)), (error) => error.statusCode === 409 && error.received === 8);
  const done = await store.appendChunk(uploadId, 8, bytes.subarray(8));
  assert.equal(done.url, `/uploads/testimonials/${uploadId}.mov`);
});

test("more bytes than announced, empty chunks and bad ids are refused", async () => {
  const store = await newStore();
  const { uploadId } = await store.start({ fileName: "clip.mp4", size: 16 });
  await assert.rejects(store.appendChunk(uploadId, 0, mp4Bytes(17)), { statusCode: 400 });
  await assert.rejects(store.appendChunk(uploadId, 0, Buffer.alloc(0)), { statusCode: 400 });
  await assert.rejects(store.appendChunk("../../etc/passwd", 0, Buffer.from("x")), { statusCode: 400 });
  await assert.rejects(store.appendChunk("6f1f8a2e-3b4c-4d5e-8f60-718293a4b5c6", 0, Buffer.from("x")), { statusCode: 404 });
});

test("a file that is not a video is rejected and removed", async () => {
  const store = await newStore();
  const fake = Buffer.from("%PDF-1.7 not a video at all");
  const { uploadId } = await store.start({ fileName: "fake.mp4", size: fake.length });
  await assert.rejects(store.appendChunk(uploadId, 0, fake), { statusCode: 400 });
  assert.deepEqual(await fsp.readdir(store.partsDir), []);
  assert.equal(fs.existsSync(store.videosDir) ? (await fsp.readdir(store.videosDir)).length : 0, 0);
});

test("video signatures: MP4/MOV boxes and WebM EBML", () => {
  assert.equal(looksLikeVideo(mp4Bytes(16), "mp4"), true);
  const webm = Buffer.alloc(16);
  webm.writeUInt32BE(0x1a45dfa3, 0);
  assert.equal(looksLikeVideo(webm, "webm"), true);
  assert.equal(looksLikeVideo(webm, "mp4"), false);
  assert.equal(looksLikeVideo(mp4Bytes(16), "webm"), false);
  assert.equal(looksLikeVideo(Buffer.from("short"), "mp4"), false);
});

test("only published video paths map to files (no path traversal)", async () => {
  const store = await newStore();
  const id = "6f1f8a2e-3b4c-4d5e-8f60-718293a4b5c6";
  assert.equal(store.storedVideoPath(`/uploads/testimonials/${id}.mp4`), path.join(store.videosDir, `${id}.mp4`));
  for (const url of [`/uploads/testimonials/../${id}.mp4`, `/uploads/cv-1.pdf`, `/uploads/testimonials/${id}.exe`, "https://drive.google.com/file/d/x/preview", "", null]) {
    assert.equal(store.storedVideoPath(url), null, String(url));
  }
  assert.equal(await store.storedVideoExists(`/uploads/testimonials/${id}.mp4`), false);
});

test("concurrent chunks for the same upload never interleave", async () => {
  const store = await newStore();
  const bytes = mp4Bytes(20);
  const { uploadId } = await store.start({ fileName: "clip.mp4", size: bytes.length });
  const results = await Promise.allSettled([
    store.appendChunk(uploadId, 0, bytes.subarray(0, 10)),
    store.appendChunk(uploadId, 0, bytes.subarray(0, 10)),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.statusCode, 409);
});

test("cleanup removes unused old videos and abandoned uploads, keeps the rest", async () => {
  let clock = Date.now();
  const store = await newStore({ now: () => clock });
  const publish = async () => {
    const bytes = mp4Bytes(16);
    const { uploadId } = await store.start({ fileName: "clip.mp4", size: bytes.length });
    return (await store.appendChunk(uploadId, 0, bytes)).url;
  };
  const used = await publish();
  const unused = await publish();
  await store.start({ fileName: "abandoned.mp4", size: 100 });

  // Juste après l'envoi : rien n'est supprimé (le formulaire n'est peut-être pas encore enregistré).
  assert.deepEqual(await store.cleanupOrphans([used]), { videos: 0, parts: 0 });
  clock += 7 * 60 * 60 * 1000;
  assert.deepEqual(await store.cleanupOrphans([used]), { videos: 1, parts: 0 });
  assert.equal(await store.storedVideoExists(used), true);
  assert.equal(await store.storedVideoExists(unused), false);
  clock += 24 * 60 * 60 * 1000;
  assert.deepEqual(await store.cleanupOrphans([used]), { videos: 0, parts: 1 });
  assert.equal(await store.storedVideoExists(used), true);
});

test("removeStoredVideo deletes only a published video", async () => {
  const store = await newStore();
  const bytes = mp4Bytes(16);
  const { uploadId } = await store.start({ fileName: "clip.mp4", size: bytes.length });
  const { url } = await store.appendChunk(uploadId, 0, bytes);
  await store.removeStoredVideo("/uploads/cv-1.pdf");
  assert.equal(await store.storedVideoExists(url), true);
  await store.removeStoredVideo(url);
  assert.equal(await store.storedVideoExists(url), false);
});
