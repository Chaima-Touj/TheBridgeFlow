import assert from "node:assert/strict";
import test from "node:test";
import User from "./users.model.js";

test("requires passwords for local users but permits OAuth identities", () => {
  const localUser = new User({ name: "Local", email: "local@example.com" });
  assert.equal(localUser.validateSync()?.errors.password?.kind, "required");

  const googleUser = new User({ name: "Google", email: "google@example.com", googleId: "google-id" });
  assert.equal(googleUser.validateSync()?.errors.password, undefined);

  const facebookUser = new User({ name: "Facebook", email: "facebook@example.com", facebookId: "facebook-id" });
  assert.equal(facebookUser.validateSync()?.errors.password, undefined);
});
