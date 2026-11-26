import test from "node:test";
import assert from "node:assert/strict";
import { canonicalHostUrl } from "./canonicalHost.js";

const loc = (href) => {
  const url = new URL(href);
  return { protocol: url.protocol, hostname: url.hostname, port: url.port, pathname: url.pathname, search: url.search, hash: url.hash };
};
const API = "https://9antra.tn/api";

test("www address goes to the main domain, same page", () => {
  assert.equal(canonicalHostUrl(loc("https://www.9antra.tn/events?period=past#top"), API), "https://9antra.tn/events?period=past#top");
  assert.equal(canonicalHostUrl(loc("https://www.9antra.tn/"), API), "https://9antra.tn/");
});

test("nothing to do on the main domain, in development or on another domain", () => {
  assert.equal(canonicalHostUrl(loc("https://9antra.tn/offers"), API), null);
  assert.equal(canonicalHostUrl(loc("http://localhost:5173/"), "http://localhost:5000/api"), null);
  assert.equal(canonicalHostUrl(loc("https://the-bridge-flow.onrender.com/"), API), null);
  assert.equal(canonicalHostUrl(loc("https://www.example.com/"), API), null);
});

test("missing or relative API URL: no redirect", () => {
  assert.equal(canonicalHostUrl(loc("https://www.9antra.tn/"), undefined), null);
  assert.equal(canonicalHostUrl(loc("https://www.9antra.tn/"), "/api"), null);
});
