import test from "node:test";
import assert from "node:assert/strict";
import { ADVISOR_RULES, BUILD_KNOWLEDGE, FACE_KNOWLEDGE, brief } from "../lib/knowledge";
import { buildOf, heightBand } from "../lib/style/build";
import { itemFit, outfitFit, type StyleItem } from "../lib/style/score";
import { EMPTY_PROFILE, normalizeProfile, type Profile } from "../lib/style/profile";
import { FACE_SHAPES } from "../lib/style/face";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prof = (over: Record<string, any> = {}): Profile =>
  normalizeProfile({ ...EMPTY_PROFILE, ...over, basics: { ...EMPTY_PROFILE.basics, ...over.basics } });

test("build comes from the avatar slider first, then from height and weight", () => {
  assert.equal(buildOf(prof()), null);
  assert.equal(buildOf(prof({ basics: { height: 180, weight: 55 } }))?.key, "lean");      // BMI 17
  assert.equal(buildOf(prof({ basics: { height: 175, weight: 70 } }))?.key, "average");   // BMI 22.9
  assert.equal(buildOf(prof({ basics: { height: 170, weight: 90 } }))?.key, "fuller");    // BMI 31
  const slider = prof({ basics: { height: 170, weight: 90 }, avatar: { ...EMPTY_PROFILE.avatar, build: -0.6 } });
  assert.equal(buildOf(slider)?.key, "lean", "what you set yourself wins");
  assert.equal(heightBand(160), "shorter"); assert.equal(heightBand(172), "average"); assert.equal(heightBand(190), "taller"); assert.equal(heightBand(null), null);
});

test("every face shape has complete hair, beard, glasses and neckline notes", () => {
  for (const s of FACE_SHAPES) {
    const k = FACE_KNOWLEDGE[s];
    for (const t of [k.traits, k.hair.works, k.hair.avoid, k.beard.works, k.beard.avoid, k.glasses.works, k.glasses.avoid, k.sunglasses, k.neckline]) assert.ok(t.length > 20, `${s} is missing text`);
  }
});

test("the briefing only carries what applies to this person", () => {
  const p = prof({ basics: { height: 178, weight: 55, direction: "Menswear" }, face: { ...EMPTY_PROFILE.face, shape: "round" } });
  const g = brief(p, "grooming");
  assert.match(g, /ROUND FACE/);
  assert.match(g, /Glasses work: Angular frames/);
  assert.doesNotMatch(g, /SQUARE FACE/);
  assert.doesNotMatch(g, /LEAN BUILD/, "grooming does not need outfit knowledge");
  const o = brief(p, "outfits");
  assert.match(o, /LEAN BUILD/);
  assert.match(o, /Layer: a tee or shirt under an overshirt/);
  assert.match(o, /build: lean/);
  assert.match(brief(prof(), "all"), /no basics given/);
  assert.match(ADVISOR_RULES, /never suggest surgery/);
});

const tee: StyleItem = { id: "t", category: "Tops", colorHex: "#c9c3b6", name: "Tee", fit: "regular", formality: 1 };
const jeans: StyleItem = { id: "b", category: "Bottoms", colorHex: "#2f3a4a", name: "Jeans", fit: "straight", formality: 1 };
const shirt: StyleItem = { id: "o", category: "Outerwear", colorHex: "#5a6b4a", name: "Overshirt", fit: "regular", formality: 1 };

test("a lean frame is nudged toward layering; the same outfit is not penalised for an average build", () => {
  const lean = prof({ basics: { height: 180, weight: 56 } });
  const avg = prof({ basics: { height: 175, weight: 70 } });
  const flatLean = outfitFit([tee, jeans], lean).score, layeredLean = outfitFit([tee, shirt, jeans], lean).score;
  assert.ok(layeredLean - flatLean >= 8, `layering should win for a lean build (${flatLean} → ${layeredLean})`);
  assert.ok(outfitFit([tee, shirt, jeans], lean).reasons.some((r) => /Layered|depth/i.test(r.text)));
  assert.ok(outfitFit([tee, jeans], lean).reasons.some((r) => /single layer/i.test(r.text)));
  assert.ok(!outfitFit([tee, jeans], avg).reasons.some((r) => /single layer/i.test(r.text)));
  assert.ok(itemFit(shirt, lean).reasons.some((r) => /layer adds depth/i.test(r.text)));
});

test("fuller builds and shorter heights get their own notes", () => {
  const fuller = prof({ basics: { height: 172, weight: 95 } });
  assert.ok(itemFit({ ...jeans, colorHex: "#1c2230" }, fuller).reasons.some((r) => /darker bottom/i.test(r.text)));
  const short = prof({ basics: { height: 158 } });
  assert.ok(itemFit({ ...jeans, attrs: { rise: "high" } }, short).reasons.some((r) => /High-rise lengthens/i.test(r.text)));
  // nothing about build is invented when the profile has no build information
  const none = prof();
  assert.ok(!itemFit(shirt, none).reasons.some((r) => /lean frame/i.test(r.text)));
  assert.ok(BUILD_KNOWLEDGE.lean.wear.some((w) => /Layer/.test(w)));
});
