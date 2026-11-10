import test from "node:test";
import assert from "node:assert/strict";
import { verifyRecaptcha } from "../middleware/recaptcha.middleware.js";

const ENV_KEYS = ["RECAPTCHA_SECRET_KEY", "RECAPTCHA_V2_SECRET_KEY", "RECAPTCHA_ALLOWED_HOSTNAMES", "NODE_ENV"];

function createRequest({ method = "POST", path = "/auth/login", token = "test-token" } = {}) {
  const headers = { "x-recaptcha-token": token };
  return {
    method,
    path,
    originalUrl: `/api${path}`,
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

async function withEnv(values, run) {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  for (const key of ENV_KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    await run();
  } finally {
    for (const key of ENV_KEYS) {
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

const CONFIGURED = { RECAPTCHA_V2_SECRET_KEY: "v2-secret", RECAPTCHA_ALLOWED_HOSTNAMES: "localhost", NODE_ENV: "production" };

test("safe requests and tracking events are never checked", async () => {
  await withEnv(CONFIGURED, async () => {
    global.fetch = async () => { throw new Error("must not call Google"); };
    assert.equal((await callMiddleware(createRequest({ method: "GET", token: "" }))).nextCalled, true);
    assert.equal((await callMiddleware(createRequest({ path: "/track/page-visit", token: "" }))).nextCalled, true);
  });
});

test("verification is disabled while RECAPTCHA_V2_SECRET_KEY is missing, even with the old v3 key", async () => {
  await withEnv({ RECAPTCHA_SECRET_KEY: "old-v3-secret", NODE_ENV: "production" }, async () => {
    global.fetch = async () => { throw new Error("must not call Google"); };
    const { response, nextCalled } = await callMiddleware(createRequest({ token: "" }));
    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, null);
  });
});

test("a checked box verified with the v2 secret is accepted", async () => {
  await withEnv(CONFIGURED, async () => {
    let sentSecret;
    global.fetch = async (url, options) => {
      sentSecret = options.body.get("secret");
      return { ok: true, json: async () => ({ success: true, hostname: "localhost" }) };
    };
    const { nextCalled } = await callMiddleware(createRequest());
    assert.equal(nextCalled, true);
    assert.equal(sentSecret, "v2-secret");
  });
});

test("a missing token is refused once the v2 secret is configured", async () => {
  await withEnv(CONFIGURED, async () => {
    global.fetch = async () => { throw new Error("must not call Google"); };
    const { response, nextCalled } = await callMiddleware(createRequest({ token: "" }));
    assert.equal(response.statusCode, 403);
    assert.equal(nextCalled, false);
  });
});

test("an invalid token or a wrong hostname is refused", async () => {
  await withEnv(CONFIGURED, async () => {
    for (const result of [{ success: false, hostname: "localhost", "error-codes": ["invalid-input-response"] }, { success: true, hostname: "example.com" }]) {
      global.fetch = async () => ({ ok: true, json: async () => result });
      const { response, nextCalled } = await callMiddleware(createRequest());
      assert.equal(response.statusCode, 403);
      assert.equal(nextCalled, false);
    }
  });
});

test("production without RECAPTCHA_ALLOWED_HOSTNAMES fails closed (503)", async () => {
  await withEnv({ RECAPTCHA_V2_SECRET_KEY: "v2-secret", NODE_ENV: "production" }, async () => {
    global.fetch = async () => ({ ok: true, json: async () => ({ success: true, hostname: "localhost" }) });
    const { response, nextCalled } = await callMiddleware(createRequest());
    assert.equal(response.statusCode, 503);
    assert.equal(nextCalled, false);
  });
});

test("Google unreachable returns 503 without letting the request through", async () => {
  await withEnv(CONFIGURED, async () => {
    global.fetch = async () => { throw new Error("network down"); };
    const { response, nextCalled } = await callMiddleware(createRequest());
    assert.equal(response.statusCode, 503);
    assert.equal(nextCalled, false);
  });
});
