import test from "node:test";
import assert from "node:assert/strict";
import { open, seal } from "../lib/backup";

const FAST = 20_000; // keep the test quick; production uses 250k

test("encrypted backup round-trips, including large and non-ASCII content", async () => {
  const data = JSON.stringify({ app: "capsule", items: [{ name: "Kōgo — ₹3,200 overshirt 🧥" }], images: { a: "x".repeat(300_000) } });
  const box = await seal(data, "correct horse battery", FAST);
  assert.equal(box.app, "capsule-backup");
  assert.ok(!JSON.stringify(box).includes("overshirt"), "plaintext is not visible in the file");
  assert.equal(await open(box, "correct horse battery"), data);
});

test("wrong passphrase, tampering and foreign files are refused", async () => {
  const box = await seal("secret closet", "passphrase-1", FAST);
  await assert.rejects(() => open(box, "passphrase-2"), /Wrong passphrase/);
  const flipped = { ...box, data: box.data.slice(0, -4) + (box.data.endsWith("AAAA") ? "BBBB" : "AAAA") };
  await assert.rejects(() => open(flipped, "passphrase-1"), /Wrong passphrase|damaged/);
  await assert.rejects(() => open({ app: "capsule", v: 1 }, "passphrase-1"), /isn’t a Capsule encrypted backup/);
  await assert.rejects(() => open(null, "passphrase-1"), /isn’t a Capsule/);
  await assert.rejects(() => open({ ...box, iter: 1 }, "passphrase-1"), /Unsupported/);
  await assert.rejects(() => seal("x", "short"), /at least 8/);
});

test("every backup uses a fresh salt and IV", async () => {
  const a = await seal("same", "passphrase-1", FAST), b = await seal("same", "passphrase-1", FAST);
  assert.notEqual(a.salt, b.salt); assert.notEqual(a.iv, b.iv); assert.notEqual(a.data, b.data);
});
