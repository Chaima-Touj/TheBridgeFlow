import test from "node:test";
import assert from "node:assert/strict";
import { getSmtpSettings } from "../services/email.service.js";

test("defaults to the historical Gmail SMTPS settings", () => {
  assert.deepEqual(getSmtpSettings({}), { host: "smtp.gmail.com", port: 465, secure: true, requireTLS: false });
});

test("Brevo relay on port 587 uses STARTTLS", () => {
  assert.deepEqual(
    getSmtpSettings({ SMTP_HOST: "smtp-relay.brevo.com", SMTP_PORT: "587" }),
    { host: "smtp-relay.brevo.com", port: 587, secure: false, requireTLS: true },
  );
});

test("explicit SMTP_SECURE wins and invalid ports fall back to 465", () => {
  assert.equal(getSmtpSettings({ SMTP_PORT: "2525", SMTP_SECURE: "true" }).secure, true);
  assert.equal(getSmtpSettings({ SMTP_PORT: "465", SMTP_SECURE: "false" }).secure, false);
  assert.equal(getSmtpSettings({ SMTP_PORT: "abc" }).port, 465);
  assert.equal(getSmtpSettings({ SMTP_HOST: "  " }).host, "smtp.gmail.com");
});
