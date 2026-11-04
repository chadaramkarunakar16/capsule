import test from "node:test";
import assert from "node:assert/strict";
import { traits } from "../lib/style/color";
import { SEASONS, classifySeason, paletteFit, seasonByKey } from "../lib/style/seasons";
import { combine, readPhoto, readQuiz } from "../lib/style/analysis";
import { fromMeasurements, fromPose } from "../lib/style/body";
import { classifyFace, faceRatios } from "../lib/style/face";
import { EMPTY_PROFILE, normalizeProfile, type Profile } from "../lib/style/profile";
import { itemFit, outfitFit } from "../lib/style/score";

const profile = (over: Partial<Profile> = {}): Profile => normalizeProfile({ ...EMPTY_PROFILE, ...over });
const withSeason = (key: string, extra: Partial<Profile> = {}) => profile({ color: { ...EMPTY_PROFILE.color, season: key }, ...extra });

test("colour traits: warm accent, neutrals", () => {
  assert.equal(traits("#b4552d").neutral, false);
  assert.ok(traits("#b4552d").warmth > 0.4, "rust is warm");
  assert.ok(traits("#1565c0").warmth < -0.4, "royal blue is cool");
  for (const n of ["#26324d", "#f6f4ef", "#1b1b1d", "#b88a5b", "#8a8d91"]) assert.equal(traits(n).neutral, true, n);
  assert.equal(traits("#6b6b3a").neutral, false, "olive is a colour");
});

test("every season classifies to itself", () => {
  for (const s of SEASONS) assert.equal(classifySeason(s.axes).key, s.key);
  assert.equal(SEASONS.length, 12);
  for (const s of SEASONS) assert.ok(s.best.length >= 8 && s.neutrals.length >= 5 && s.avoid.length >= 4, s.key);
});

test("confidence: tie is low, clear winner is higher, weak evidence is capped", () => {
  const a = SEASONS[6].axes;
  const clear = classifySeason(a, 1).confidence;
  const weak = classifySeason(a, 0.2).confidence;
  assert.ok(clear > weak);
  const mid = { warmth: (SEASONS[6].axes.warmth + SEASONS[7].axes.warmth) / 2, depth: (SEASONS[6].axes.depth + SEASONS[7].axes.depth) / 2, clarity: (SEASONS[6].axes.clarity + SEASONS[7].axes.clarity) / 2 };
  assert.ok(classifySeason(mid, 1).confidence < clear);
  assert.ok(clear <= 0.92);
});

test("photo reading: warm skin reads warmer than rosy skin; dark hair adds depth and contrast", () => {
  const warm = readPhoto({ skin: [[228, 178, 128], [226, 176, 126]], hair: [[60, 40, 25]], eyes: [[90, 60, 40]] });
  const rosy = readPhoto({ skin: [[236, 184, 182], [234, 182, 180]], hair: [[60, 40, 25]], eyes: [[90, 60, 40]] });
  assert.ok(warm.warmth > rosy.warmth);
  const fairHair = readPhoto({ skin: [[236, 190, 160]], hair: [[210, 180, 120]], eyes: [[120, 160, 190]] });
  const darkHair = readPhoto({ skin: [[236, 190, 160]], hair: [[25, 20, 18]], eyes: [[40, 30, 25]] });
  assert.ok(darkHair.depth > fairHair.depth);
  assert.ok(darkHair.clarity > fairHair.clarity);
});

test("photo evidence is reduced by colour cast, bad exposure and missing hair/eyes", () => {
  const ok = readPhoto({ skin: [[230, 180, 140]], hair: [[60, 40, 30]], eyes: [[80, 60, 40]], castChroma: 3, exposure: 150 });
  const bad = readPhoto({ skin: [[230, 180, 140]], castChroma: 20, exposure: 40 });
  assert.ok(ok.evidence > bad.evidence);
  assert.ok(bad.notes.length >= 2);
});

test("quiz: warm answers → warm axis; nothing answered → no result", () => {
  const warm = readQuiz({ veins: "green", metal: "gold", sun: "tan-golden" });
  assert.ok((warm.axes.warmth ?? 0) > 0.8);
  assert.equal(combine([], {}), null);
  assert.equal(combine([], { veins: "green" }), null, "one answer is not enough");
  const c = combine([], { veins: "green", metal: "gold", hair: "brown-dark", contrast: "low" });
  assert.ok(c && c.axes.warmth > 0);
});

test("disagreeing photos lower confidence", () => {
  const spring = readPhoto({ skin: [[240, 200, 160]], hair: [[200, 160, 90]], eyes: [[110, 150, 120]] });
  const winter = readPhoto({ skin: [[225, 175, 175]], hair: [[20, 15, 15]], eyes: [[30, 25, 25]] });
  const agree = combine([spring, spring, spring])!;
  const split = combine([spring, winter, spring])!;
  assert.ok(agree.confidence > split.confidence, `${agree.confidence} vs ${split.confidence}`);
  assert.ok(split.notes.some((n) => /different seasons/.test(n)));
});

test("body from measurements is neutral and thresholded", () => {
  assert.equal(fromMeasurements({ chest: 110, hip: 95 }).shoulderHip, "broader-shoulders");
  assert.equal(fromMeasurements({ chest: 90, hip: 92 }).shoulderHip, "balanced");
  assert.equal(fromMeasurements({ chest: 88, hip: 104 }).shoulderHip, "broader-hips");
  assert.equal(fromMeasurements({ chest: 96, hip: 98, waist: 74 }).waist, "defined");
  assert.equal(fromMeasurements({ chest: 100, hip: 100, waist: 92 }).waist, "straight");
  assert.equal(fromMeasurements({ inseam: 85 }, 175).torsoLeg, "longer-legs");
  assert.equal(fromMeasurements({ inseam: 74 }, 175).torsoLeg, "longer-torso");
  assert.equal(fromMeasurements({ inseam: 80 }, 175).torsoLeg, "balanced");
  assert.equal(fromMeasurements({}).shoulderHip, null);
});

test("body from pose landmarks; flags low visibility", () => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 1 }));
  Object.assign(lm[11], { x: 300, y: 200 }); Object.assign(lm[12], { x: 200, y: 200 });
  Object.assign(lm[23], { x: 270, y: 400 }); Object.assign(lm[24], { x: 230, y: 400 });
  Object.assign(lm[27], { x: 285, y: 800 }); Object.assign(lm[28], { x: 215, y: 800 });
  const r = fromPose(lm)!;
  assert.equal(r.body.source, "photo");
  assert.equal(r.body.shoulderHip, "broader-shoulders"); // 100 / 40 / 1.7 = 1.47
  Object.assign(lm[23], { x: 280, y: 400 }); Object.assign(lm[24], { x: 220, y: 400 });
  assert.equal(fromPose(lm)!.body.shoulderHip, "balanced"); // 100 / 60 / 1.7 = 0.98
  Object.assign(lm[23], { x: 270, y: 400 }); Object.assign(lm[24], { x: 230, y: 400 });
  assert.equal(r.body.torsoLeg, "longer-legs"); // legs 400 vs torso 200 → 0.667
  assert.equal(r.problems.length, 0);
  lm[27].visibility = 0.2;
  assert.ok(fromPose(lm)!.problems.length > 0);
});

function faceLandmarks(o: { length: number; cheek: number; forehead: number; jaw: number; chinHalfWidth: number; chinRise: number }) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  const cx = 500;
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y });
  set(10, cx, 100); set(152, cx, 100 + o.length / 1.1);
  set(234, cx - o.cheek / 2, 300); set(454, cx + o.cheek / 2, 300);
  set(21, cx - o.forehead / 2, 160); set(251, cx + o.forehead / 2, 160);
  set(58, cx - o.jaw / 2, 420); set(288, cx + o.jaw / 2, 420);
  const cy = 100 + o.length / 1.1;
  set(172, cx - o.chinHalfWidth, cy - o.chinRise); set(397, cx + o.chinHalfWidth, cy - o.chinRise);
  return lm;
}

test("face shape rules on synthetic landmarks", () => {
  const shape = (o: Parameters<typeof faceLandmarks>[0]) => classifyFace(faceRatios(faceLandmarks(o))!);
  // long face
  assert.equal(shape({ length: 400, cheek: 235, forehead: 205, jaw: 205, chinHalfWidth: 60, chinRise: 70 }).shape, "oblong");
  // forehead wide, jaw narrow
  assert.equal(shape({ length: 335, cheek: 230, forehead: 230, jaw: 160, chinHalfWidth: 50, chinRise: 80 }).shape, "heart");
  // cheekbones widest, forehead and jaw narrow
  assert.equal(shape({ length: 335, cheek: 230, forehead: 175, jaw: 168, chinHalfWidth: 50, chinRise: 80 }).shape, "diamond");
  // short, wide jaw, flat chin
  assert.equal(shape({ length: 275, cheek: 230, forehead: 215, jaw: 218, chinHalfWidth: 95, chinRise: 55 }).shape, "square");
  // confidence is modest and ratios are exposed
  const g = shape({ length: 335, cheek: 230, forehead: 200, jaw: 190, chinHalfWidth: 70, chinRise: 70 });
  assert.ok(g.confidence <= 0.8 && g.ratios.lengthToWidth > 0);
  assert.equal(faceRatios([]), null);
});

test("palette fit: core colours help, avoid colours hurt", () => {
  const ta = seasonByKey("true-autumn")!, tw = seasonByKey("true-winter")!;
  assert.ok(paletteFit("#b4552d", ta).delta > 0, "rust in True Autumn");
  assert.ok(paletteFit("#b4552d", tw).delta <= 0, "rust in True Winter");
  assert.ok(paletteFit("#00ffff", ta).delta < 0, "icy aqua in True Autumn");
  assert.equal(paletteFit("#b4552d", null).zone, "unknown");
});

test("itemFit: personal colour matters and is explained", () => {
  const rust = { category: "Tops", colorHex: "#b4552d", colorName: "Rust", fit: "fitted" };
  const a = itemFit(rust, withSeason("true-autumn"));
  const w = itemFit(rust, withSeason("true-winter"));
  assert.ok(a.score > w.score, `${a.score} vs ${w.score}`);
  assert.ok(a.reasons.some((r) => r.kind === "colour"));
  assert.ok(itemFit(rust, profile()).needs.includes("colour"), "asks for the profile when empty");
});

test("itemFit: proportions follow the profile, never negative about the body itself", () => {
  const wide = { category: "Bottoms", colorHex: "#1b1b1d", fit: "wide" };
  const shoulders = withSeason("true-autumn", { body: { ...EMPTY_PROFILE.body, shoulderHip: "broader-shoulders", source: "self" } });
  const f = itemFit(wide, shoulders);
  assert.ok(f.reasons.some((r) => r.kind === "proportion" && r.delta > 0));
  for (const r of f.reasons) assert.ok(!/too (big|wide|fat|heavy)/i.test(r.text));
  const high = itemFit({ category: "Bottoms", colorHex: "#2d3a55", fit: "straight", attrs: { rise: "high" } }, profile({ body: { ...EMPTY_PROFILE.body, torsoLeg: "longer-torso", source: "self" } }));
  assert.ok(high.reasons.some((r) => /High-rise/.test(r.text)));
});

test("itemFit: neckline vs face shape needs the attribute", () => {
  const p = profile({ face: { ...EMPTY_PROFILE.face, shape: "round" } });
  const noNeck = itemFit({ category: "Tops", colorHex: "#ede3d0" }, p);
  assert.ok(noNeck.needs.includes("neckline"));
  const v = itemFit({ category: "Tops", colorHex: "#ede3d0", attrs: { neckline: "v-neck" } }, p);
  assert.ok(v.reasons.some((r) => r.kind === "face" && r.delta > 0));
});

test("outfitFit: harmony, patterns and formality", () => {
  const p = withSeason("soft-autumn");
  const tee = { category: "Tops", colorHex: "#b4552d", colorName: "Rust", fit: "fitted", formality: 1, pattern: "solid" };
  const pants = { category: "Bottoms", colorHex: "#1b1b1d", colorName: "Black", fit: "wide", formality: 1, pattern: "solid" };
  const good = outfitFit([tee, pants], p);
  assert.ok(good.score >= 70, String(good.score));
  assert.ok(good.reasons.length > 0 && good.reasons.length <= 4);

  const clash = outfitFit([{ ...tee, colorHex: "#d6193a", colorName: "Red" }, { ...pants, colorHex: "#00a3c4", colorName: "Teal" }], p);
  // red and teal are complementary-ish; use a genuinely clashing trio instead
  const trio = outfitFit([{ ...tee, colorHex: "#e91e8c" }, { ...pants, colorHex: "#2ecc71" }, { category: "Outerwear", colorHex: "#ff9f1c", fit: "regular", formality: 1 }], p);
  assert.ok(trio.score < good.score, `${trio.score} < ${good.score}`);
  assert.ok(clash.score > 0);

  const twoPatterns = outfitFit([{ ...tee, colorHex: "#f6f4ef", pattern: "striped" }, { ...pants, pattern: "floral" }], p);
  assert.ok(twoPatterns.reasons.some((r) => r.kind === "pattern" && r.delta < 0));

  const gap = outfitFit([{ ...tee, formality: 1 }, { ...pants, formality: 3 }], p);
  assert.ok(gap.reasons.some((r) => r.kind === "formality" && r.delta < 0));

  const onTarget = outfitFit([{ ...tee, formality: 3 }, { ...pants, formality: 3 }], p, 3);
  const offTarget = outfitFit([{ ...tee, formality: 1 }, { ...pants, formality: 1 }], p, 3);
  assert.ok(onTarget.score > offTarget.score);
});

test("outfitFit: muted earth tones are not called a clash; loud ones are", () => {
  const p = withSeason("soft-autumn");
  const rust = { category: "Tops", colorHex: "#b4552d", colorName: "Rust", fit: "fitted", formality: 1 };
  const olive = { category: "Outerwear", colorHex: "#6b6b3a", colorName: "Olive", fit: "regular", formality: 1 };
  const earthy = outfitFit([rust, olive], p);
  assert.ok(!earthy.reasons.some((r) => r.kind === "harmony" && r.delta < 0), JSON.stringify(earthy.reasons));
  const loud = outfitFit([{ ...rust, colorHex: "#e91e8c" }, { ...olive, colorHex: "#ff9f1c" }], p);
  assert.ok(loud.reasons.some((r) => r.kind === "harmony" && r.delta < 0));
});

test("avoid-colour wording depends on where the piece is worn", () => {
  const p = withSeason("soft-autumn");
  const top = itemFit({ category: "Tops", colorHex: "#000000" }, p);
  const bottom = itemFit({ category: "Bottoms", colorHex: "#000000" }, p);
  assert.ok(top.reasons.some((r) => /face/.test(r.text)));
  assert.ok(bottom.reasons.every((r) => !/away from your face/.test(r.text)));
});

test("outfitFit: score is always within 35..98 and an empty outfit scores 0", () => {
  assert.equal(outfitFit([], profile()).score, 0);
  const s = outfitFit([{ category: "Tops", colorHex: "#00ffff", fit: "oversized", formality: 1 }, { category: "Bottoms", colorHex: "#ff00ff", fit: "wide", formality: 3 }], withSeason("true-autumn"));
  assert.ok(s.score >= 35 && s.score <= 98);
});
