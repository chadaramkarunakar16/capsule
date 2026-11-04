import test, { before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.CAPSULE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-auth-"));
let auth: typeof import("../lib/auth");
before(async () => { auth = await import("../lib/auth"); });

test("PIN: set, verify, reject wrong or malformed", () => {
  assert.equal(auth.hasPin(), false);
  assert.equal(auth.verifyPin("1234"), false, "no PIN set → nothing verifies");
  auth.setPin("2468");
  assert.equal(auth.hasPin(), true);
  assert.equal(auth.verifyPin("2468"), true);
  assert.equal(auth.verifyPin("2469"), false);
  assert.equal(auth.verifyPin(""), false);
  for (const bad of ["12", "abcd", "1234567890123", "12 34"]) assert.throws(() => auth.setPin(bad), /4 to 12 digits/);
  const stored = fs.readFileSync(path.join(process.env.CAPSULE_DATA_DIR!, "settings.json"), "utf8");
  assert.ok(!stored.includes("2468"), "the PIN itself is never stored");
});

test("session tokens: valid, expired, tampered, and logged out by a PIN change", () => {
  auth.setPin("2468");
  const now = 1_000_000;
  const t = auth.makeToken(now);
  assert.equal(auth.verifyToken(t, now + 1000), true);
  assert.equal(auth.verifyToken(t, now + 31 * 86400_000), false, "expires after 30 days");
  assert.equal(auth.verifyToken(t.replace(/.$/, (c) => (c === "0" ? "1" : "0")), now + 1000), false, "tampered signature");
  assert.equal(auth.verifyToken("9999999999999.deadbeef", now), false);
  for (const junk of [undefined, null, "", "x", "1.2.3", "abc.def"]) assert.equal(auth.verifyToken(junk as string, now), false);
  auth.setPin("1357"); // changing the PIN rotates the secret
  assert.equal(auth.verifyToken(t, now + 1000), false, "old sessions end when the PIN changes");
  auth.setPin(null);
  assert.equal(auth.hasPin(), false);
});

test("throttle: five wrong PINs lock the client for five minutes", () => {
  const t0 = 5_000_000;
  for (let i = 0; i < 4; i++) { auth.noteFailure("a", t0 + i); assert.equal(auth.throttled("a", t0 + i + 1), false); }
  auth.noteFailure("a", t0 + 5);
  assert.equal(auth.throttled("a", t0 + 6), true);
  assert.equal(auth.throttled("b", t0 + 6), false, "other clients aren't affected");
  assert.equal(auth.throttled("a", t0 + 301_000), false, "unlocks after five minutes");
  auth.clearFailures("a");
  assert.equal(auth.throttled("a", t0 + 7), false);
});
