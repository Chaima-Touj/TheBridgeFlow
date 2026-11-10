import test from "node:test";
import assert from "node:assert/strict";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";

// Les tests ne doivent pas dépendre d'une clé v2 présente dans l'environnement.
delete process.env.RECAPTCHA_V2_SECRET_KEY;

function createRequest({ method = "POST", path = "/auth/login", token = "test-token", version } = {}) {
  const headers = { "x-recaptcha-token": token, "x-recaptcha-version": version };
  return {
    method,
    path,
    ip: "127.0.0.1",
    get: (name) => headers[name.toLowerCase()],
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

test("reCAPTCHA middleware is disabled, even in production, when no secret is configured", async () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;
  const originalAllowedHostnames = process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  const originalEnvironment = process.env.NODE_ENV;
  delete process.env.RECAPTCHA_SECRET_KEY;
  delete process.env.RECAPTCHA_ALLOWED_HOSTNAMES;
  process.env.NODE_ENV = "production";
  const response = createResponse();
  let nextCalled = false;
  try {
    await verifyRecaptcha(createRequest({ token: "" }), response, () => { nextCalled = true; });
    assert.equal(response.statusCode, null);
    assert.equal(nextCalled, true);
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

// ─── reCAPTCHA v2 « Je ne suis pas un robot » ────────────────────────────────

async function withEnv(values, run) {
  const keys = ["RECAPTCHA_SECRET_KEY", "RECAPTCHA_V2_SECRET_KEY", "RECAPTCHA_ALLOWED_HOSTNAMES", "NODE_ENV"];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    await run();
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    global.fetch = originalFetch;
  }
}

async function callMiddleware(request) {
  const response = createResponse();
  let nextCalled = false;
  await verifyRecaptcha(request, response, () => { nextCalled = true; });
  return { response, nextCalled };
}

test("reCAPTCHA v2 accepts a checked box (no score/action) verified with the v2 secret", async () => {
  await withEnv({ RECAPTCHA_V2_SECRET_KEY: "v2-secret", RECAPTCHA_ALLOWED_HOSTNAMES: "localhost" }, async () => {
    let sentSecret;
    global.fetch = async (url, options) => {
      sentSecret = options.body.get("secret");
      return { ok: true, json: async () => ({ success: true, hostname: "localhost" }) };
    };
    const { nextCalled } = await callMiddleware(createRequest({ version: "v2" }));
    assert.equal(nextCalled, true);
    assert.equal(sentSecret, "v2-secret");
  });
});

test("reCAPTCHA v2 rejects an invalid token or a wrong hostname", async () => {
  await withEnv({ RECAPTCHA_V2_SECRET_KEY: "v2-secret", RECAPTCHA_ALLOWED_HOSTNAMES: "localhost" }, async () => {
    for (const result of [{ success: false, hostname: "localhost" }, { success: true, hostname: "example.com" }]) {
      global.fetch = async () => ({ ok: true, json: async () => result });
      const { response, nextCalled } = await callMiddleware(createRequest({ version: "v2" }));
      assert.equal(response.statusCode, 403);
      assert.equal(nextCalled, false);
    }
  });
});

test("reCAPTCHA v2 token is refused (503) when only the v3 secret is configured", async () => {
  await withEnv({ RECAPTCHA_SECRET_KEY: "v3-secret", RECAPTCHA_ALLOWED_HOSTNAMES: "localhost" }, async () => {
    global.fetch = async () => { throw new Error("must not call Google"); };
    const { response, nextCalled } = await callMiddleware(createRequest({ version: "v2" }));
    assert.equal(response.statusCode, 503);
    assert.equal(nextCalled, false);
  });
});

test("with only the v2 secret, requests without token or with a v3 token are never let through", async () => {
  await withEnv({ RECAPTCHA_V2_SECRET_KEY: "v2-secret", RECAPTCHA_ALLOWED_HOSTNAMES: "localhost", NODE_ENV: "production" }, async () => {
    global.fetch = async () => ({ ok: true, json: async () => successfulVerification });
    for (const request of [createRequest({ token: "" }), createRequest(), createRequest({ version: "v3" })]) {
      const { response, nextCalled } = await callMiddleware(request);
      assert.equal(response.statusCode, 403);
      assert.equal(nextCalled, false);
    }
  });
});

test("v3 tokens keep working while the v2 secret is also configured (transition)", async () => {
  await withEnv({ RECAPTCHA_SECRET_KEY: "v3-secret", RECAPTCHA_V2_SECRET_KEY: "v2-secret", RECAPTCHA_ALLOWED_HOSTNAMES: "localhost" }, async () => {
    let sentSecret;
    global.fetch = async (url, options) => {
      sentSecret = options.body.get("secret");
      return { ok: true, json: async () => successfulVerification };
    };
    const { nextCalled } = await callMiddleware(createRequest());
    assert.equal(nextCalled, true);
    assert.equal(sentSecret, "v3-secret");
  });
});
