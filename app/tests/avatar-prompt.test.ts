import test from "node:test";
import assert from "node:assert/strict";
import { avatarPrompt, proportionSentence } from "../lib/avatar/prompt";
import { EMPTY_PROFILE, normalizeProfile } from "../lib/style/profile";

const withBody = normalizeProfile({
  basics: { ...EMPTY_PROFILE.basics, height: 172 },
  body: { shoulderHip: "broader-shoulders", torsoLeg: "longer-legs", waist: "straight", source: "photo" },
});

test("proportions from the profile are spelled out for the image model", () => {
  const s = proportionSentence(withBody);
  assert.match(s, /about 172 cm tall/);
  assert.match(s, /shoulders broader than hips/);
  assert.match(s, /longer legs/);
  assert.equal(proportionSentence(normalizeProfile(null)), "");
});

test("the prompt names which reference is which, and forbids idealising the body", () => {
  const both = avatarPrompt(withBody, { body: true, face: true });
  assert.match(both, /Image 1 is a full-body photo and image 2 is a face photo/);
  assert.match(both, /do not make them slimmer, more muscular, taller, shorter or more idealised/);
  assert.match(both, /IDENTITY IS THE TOP PRIORITY/);
  assert.match(both, /PHYSIQUE MUST BE CLEARLY VISIBLE/);
  assert.match(both, /well-fitted \(not baggy\)/);
  assert.match(both, /Known proportions/);
  assert.match(avatarPrompt(withBody, { body: false, face: true }), /face photo of one real person/);
});

test("older saved profiles gain the new avatar fields with safe defaults", () => {
  const old = normalizeProfile({ avatar: { skin: "#e0ac86", hair: null, hairStyle: "short", build: null, shoulders: 0, hips: 0, legs: 0, waist: 0 } as never });
  assert.equal(old.avatar.look, "figure");
  assert.equal(old.avatar.photo, null);
  assert.equal(old.avatar.aiImage, null);
});
