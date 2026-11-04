import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PROFILE, normalizeProfile, type Profile } from "../lib/style/profile";
import { CANVAS, DEFAULT_ASPECT, defaultBuild, geometry, layers, placeItem } from "../lib/avatar/geometry";

type O = { body?: Partial<Profile["body"]>; avatar?: Partial<Profile["avatar"]>; basics?: Partial<Profile["basics"]>; measurements?: Profile["measurements"] };
const P = (over: O = {}): Profile =>
  normalizeProfile({ ...EMPTY_PROFILE, measurements: over.measurements ?? {}, body: { ...EMPTY_PROFILE.body, ...over.body }, avatar: { ...EMPTY_PROFILE.avatar, ...over.avatar }, basics: { ...EMPTY_PROFILE.basics, ...over.basics } });

test("shoulder/hip proportions follow the profile", () => {
  const bs = geometry(P({ body: { shoulderHip: "broader-shoulders", source: "self" } }));
  const bl = geometry(P({ body: { shoulderHip: "balanced", source: "self" } }));
  const bh = geometry(P({ body: { shoulderHip: "broader-hips", source: "self" } }));
  assert.ok(bs.shoulderHalf > bs.hipHalf);
  assert.ok(bh.hipHalf > bh.shoulderHalf);
  assert.ok(Math.abs(bl.shoulderHalf - bl.hipHalf) < bl.shoulderHalf * 0.2);
  assert.ok(bs.shoulderHalf > bl.shoulderHalf && bh.hipHalf > bl.hipHalf);
});

test("torso/leg balance and the legs slider move the waist, hip and crotch", () => {
  const long = geometry(P({ body: { torsoLeg: "longer-legs", source: "self" } }));
  const base = geometry(P());
  const torso = geometry(P({ body: { torsoLeg: "longer-torso", source: "self" } }));
  assert.ok(long.crotchY < base.crotchY && base.crotchY < torso.crotchY);
  assert.ok(geometry(P({ avatar: { legs: 1 } })).crotchY < base.crotchY);
  assert.equal(long.footY, base.footY, "the figure is always the same height");
});

test("build: slider and BMI starting point widen the figure; measurements win", () => {
  assert.equal(defaultBuild(null, 70), 0);
  assert.equal(defaultBuild(175, null), 0);
  assert.ok(defaultBuild(175, 95) > defaultBuild(175, 70));
  assert.ok(defaultBuild(175, 45) < 0);
  assert.ok(defaultBuild(175, 200) <= 1 && defaultBuild(175, 30) >= -0.7);
  const slim = geometry(P({ avatar: { build: -0.6 } })), broad = geometry(P({ avatar: { build: 0.8 } }));
  assert.ok(broad.hipHalf > slim.hipHalf && broad.shoulderHalf > slim.shoulderHalf);
  const fromWeight = geometry(P({ basics: { height: 175, weight: 100 } }));
  assert.ok(fromWeight.hipHalf > geometry(P({ basics: { height: 175, weight: 60 } })).hipHalf);
  const measured = geometry(P({ measurements: { chest: 110, hip: 90, waist: 80 }, avatar: { build: 1 } }));
  assert.ok(Math.abs(measured.shoulderHalf - geometry(P({ measurements: { chest: 110, hip: 90, waist: 80 }, avatar: { build: -1 } })).shoulderHalf) < 1e-9, "build is ignored when measured");
  assert.ok(measured.shoulderHalf > measured.hipHalf);
});

test("taller people get a proportionally slimmer figure (same px height, same cm widths)", () => {
  const short = geometry(P({ basics: { height: 160, weight: null } }));
  const tall = geometry(P({ basics: { height: 195, weight: null } }));
  assert.ok(tall.shoulderHalf < short.shoulderHalf);
  assert.equal(tall.H, short.H);
});

test("figure stays on the canvas and is ordered head → feet", () => {
  for (const body of [{ shoulderHip: "broader-shoulders" as const }, { shoulderHip: "broader-hips" as const }, {}]) {
    const g = geometry(P({ body: { ...body, source: "self" }, avatar: { build: 1, shoulders: 1, hips: 1 } }));
    assert.ok(g.cx - g.shoulderHalf - 40 > 0 && g.cx + g.shoulderHalf + 40 < CANVAS.w, "shoulders fit with room for arms");
    const bag = placeItem("Bags", 1.2, g)!; assert.ok(bag.x + bag.w <= CANVAS.w, "bag stays on the canvas");
    const ys = [g.top, g.chinY, g.shoulderY, g.chestY, g.waistY, g.hipY, g.crotchY, g.kneeY, g.ankleY, g.footY];
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1], `y order at ${i}`);
    assert.ok(g.footY <= CANVAS.h);
    assert.ok(g.waistHalf <= Math.max(g.shoulderHalf, g.hipHalf) * 1.05);
  }
});

test("garments are placed on the right part of the body, inside the canvas", () => {
  const g = geometry(P({ body: { shoulderHip: "balanced", source: "self" } }));
  const top = placeItem("Tops", 1.1, g)!, bottom = placeItem("Bottoms", 0.55, g)!, shoes = placeItem("Shoes", 1.6, g)!, coat = placeItem("Outerwear", 1.0, g)!, bag = placeItem("Bags", 1.2, g)!;
  assert.ok(top.y < g.shoulderY && top.y + top.h > g.waistY, "top spans shoulders to waist");
  assert.ok(bottom.y <= g.waistY && bottom.y + bottom.h > g.ankleY - 20, "bottoms reach the ankles");
  assert.ok(shoes.y + shoes.h >= g.footY, "shoes sit on the floor");
  assert.ok(coat.w > top.w, "outerwear is wider than a top");
  assert.ok(bag.x > g.cx + g.hipHalf, "bag hangs at the side");
  for (const r of [top, bottom, shoes, coat, bag]) { assert.ok(r.x >= 0 && r.x + r.w <= CANVAS.w, JSON.stringify(r)); assert.ok(r.y >= 0 && r.y + r.h <= CANVAS.h + 12); }
  assert.equal(placeItem("Accessories", 1, g), null);
  // length attributes
  const cropped = placeItem("Outerwear", 0.6, g, { length: "cropped" })!, long = placeItem("Outerwear", 0.6, g, { length: "long" })!; // tall photos get capped by the stated length
  assert.ok(cropped.y + cropped.h < long.y + long.h);
  assert.ok(placeItem("Tops", 1.6, g, { fit: "oversized" })!.w > placeItem("Tops", 1.6, g, { fit: "fitted" })!.w);
});

test("very wide or very tall photos never blow past the figure", () => {
  const g = geometry(P());
  const wideTop = placeItem("Tops", 4, g)!, tallBottom = placeItem("Bottoms", 0.2, g)!, wideBottom = placeItem("Bottoms", 3, g)!;
  assert.ok(wideTop.h > 0 && wideTop.x >= 0 && wideTop.x + wideTop.w <= CANVAS.w);
  assert.ok(tallBottom.w > 0 && wideBottom.w <= g.hipHalf * 2 * 2.1 + 0.001);
});

test("layering: order, and a dress replaces tops and bottoms", () => {
  const items = [{ category: "Bags" }, { category: "Outerwear" }, { category: "Tops" }, { category: "Shoes" }, { category: "Bottoms" }, { category: "Accessories" }];
  assert.deepEqual(layers(items).map((i) => i.category), ["Bottoms", "Shoes", "Tops", "Outerwear", "Bags"]);
  assert.deepEqual(layers([{ category: "Dresses" }, { category: "Tops" }, { category: "Bottoms" }, { category: "Shoes" }]).map((i) => i.category), ["Shoes", "Dresses"]);
  assert.ok(Object.keys(DEFAULT_ASPECT).length >= 6);
});
