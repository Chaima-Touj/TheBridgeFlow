import test from "node:test";
import assert from "node:assert/strict";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";

function createRequest({ method = "POST", path = "/auth/login", token = "test-token" } = {}) {
  return {
    method,
    path,
    ip: "127.0.0.1",
    get: (name) => name.toLowerCase() === "x-recaptcha-token" ? token : undefined,
  };
}

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const successfulVerification = {
  success: true,
  action: "submit",
  score: 0.9,
  hostname: "localhost",
};

test("reCAPTCHA middleware allows safe requests and tracking events", async () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalEnvironment = process.env.NODE_ENV;
  delete process.env.RECAPTCHA_SECRET_KEY;
  process.env.NODE_ENV = "production";
  let nextCalled = 0;
  try {
    await verifyRecaptcha(createRequest({ method: "GET" }), createResponse(), () => { nextCalled += 1; });
    await verifyRecaptcha(createRequest({ path: "/track/page-visit" }), createResponse(), () => { nextCalled += 1; });
    assert.equal(nextCalled, 2);
  } finally {
    if (originalSecret === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
});

test("reCAPTCHA middleware fails closed in production when no secret is configured", async () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalAllowedHostnames = process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  const originalEnvironment = process.env.NODE_ENV;
  delete process.env.RECAPTCHA_SECRET_KEY;
  delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  process.env.NODE_ENV = "production";
  const response = createResponse();
  let nextCalled = false;
  try {
    await verifyRecaptcha(createRequest(), response, () => { nextCalled = true; });
    assert.equal(response.statusCode, 503);
    assert.equal(nextCalled, false);
  } finally {
    if (originalSecret === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    if (originalAllowedHostnames === undefined) delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
    else process.env.RECAPTCHA_ALLOWED_HOSTNAMES = originalAllowedHostnames;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
});

test("reCAPTCHA middleware fails closed in production when hostname validation is unconfigured", async () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalAllowedHostnames = process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  const originalEnvironment = process.env.NODE_ENV;
  const originalFetch = global.fetch;
  process.env.RECAPTCHA_SECRET_KEY = "test-secret";
  delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  process.env.NODE_ENV = "production";
  global.fetch = async () => ({ ok: true, json: async () => successfulVerification });
  const response = createResponse();
  try {
    await verifyRecaptcha(createRequest(), response, () => {});
    assert.equal(response.statusCode, 503);
  } finally {
    if (originalSecret === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    if (originalAllowedHostnames === undefined) delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
    else process.env.RECAPTCHA_ALLOWED_HOSTNAMES = originalAllowedHostnames;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
    global.fetch = originalFetch;
  }
});

test("reCAPTCHA middleware accepts a successful v3 token above the score threshold", async () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalFetch = global.fetch;
  process.env.RECAPTCHA_SECRET_KEY = "test-secret";
  global.fetch = async () => ({ ok: true, json: async () => successfulVerification });
  let nextCalled = false;
  try {
    await verifyRecaptcha(createRequest(), createResponse(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  } finally {
    if (originalSecret === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    global.fetch = originalFetch;
  }
});

test("reCAPTCHA middleware rejects invalid, low-score, wrong-action, and wrong-host tokens", async () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalFetch = global.fetch;
  const originalAllowedHostnames = process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  process.env.RECAPTCHA_SECRET_KEY = "test-secret";
  process.env.RECAPTCHA_ALLOWED_HOSTNAMES = "localhost";
  try {
    for (const result of [
      { ...successfulVerification, success: false },
      { ...successfulVerification, score: 0.2 },
      { ...successfulVerification, action: "login" },
      { ...successfulVerification, hostname: "example.com" },
    ]) {
      global.fetch = async () => ({ ok: true, json: async () => result });
      const response = createResponse();
      let nextCalled = false;
      await verifyRecaptcha(createRequest(), response, () => { nextCalled = true; });
      assert.equal(response.statusCode, 403);
      assert.equal(nextCalled, false);
    }

    global.fetch = async () => ({ ok: true, json: async () => successfulVerification });
    const missingResponse = createResponse();
    await verifyRecaptcha(createRequest({ token: "" }), missingResponse, () => {});
    assert.equal(missingResponse.statusCode, 403);
  } finally {
    if (originalSecret === undefined) delete process.env.RECAPTCHA_SECRET_KEY;
    else process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    if (originalAllowedHostnames === undefined) delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
    else process.env.RECAPTCHA_ALLOWED_HOSTNAMES = originalAllowedHostnames;
    global.fetch = originalFetch;
  }
});
