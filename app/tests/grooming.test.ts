import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PROFILE, normalizeProfile, type Grooming, type Profile } from "../lib/style/profile";
import { FACE_SHAPES, type FaceShape } from "../lib/style/face";
import { BEARDS, FRAMES, HAIRSTYLES } from "../lib/grooming/catalog";
import { barberText, frameColours, suggestBeards, suggestFrames, suggestHair } from "../lib/grooming/suggest";
import { FACE_PARAMS, anchors, beardShapes, bodyPath, framePaths, glassesPlacement, hairShapes, headPath, partLine, type BeardKind } from "../lib/grooming/draw";

const prof = (face: FaceShape | null, g: Partial<Grooming> = {}, season: string | null = null): Profile =>
  normalizeProfile({ ...EMPTY_PROFILE, face: { ...EMPTY_PROFILE.face, shape: face }, color: { ...EMPTY_PROFILE.color, season }, grooming: { ...EMPTY_PROFILE.grooming, ...g } });
const bad = (s: string) => /NaN|undefined|Infinity/.test(s);
const rank = <T extends { item: { id: string } }>(r: T[], id: string) => r.findIndex((x) => x.item.id === id);

test("catalogue is consistent", () => {
  for (const list of [HAIRSTYLES, BEARDS, FRAMES]) assert.equal(new Set(list.map((x) => x.id)).size, list.length, "unique ids");
  for (const h of HAIRSTYLES) {
    assert.ok(h.ask.length > 30 && h.tips.length >= 1 && h.textures.length >= 1, h.id);
    for (const k of Object.keys(h.faces)) assert.ok(FACE_SHAPES.includes(k as FaceShape), `${h.id}: ${k}`);
    for (const f of FACE_SHAPES) assert.ok(h.faces[f] != null, `${h.id} scores ${f}`);
  }
  for (const b of BEARDS) for (const f of FACE_SHAPES) assert.ok(b.faces[f] != null, `${b.id} scores ${f}`);
  for (const f of FRAMES) for (const s of FACE_SHAPES) assert.ok(f.faces[s] != null, `${f.id} scores ${s}`);
  assert.ok(HAIRSTYLES.length >= 20 && BEARDS.length >= 7 && FRAMES.length >= 10);
  for (const t of ["straight", "wavy", "curly", "coily"] as const) assert.ok(HAIRSTYLES.filter((h) => h.textures.includes(t)).length >= 8, `enough styles for ${t} hair`);
});

test("hair: face shape changes the ranking in the expected direction", () => {
  const round = suggestHair(prof("round")), oblong = suggestHair(prof("oblong"));
  assert.ok(rank(round, "quiff") < rank(oblong, "quiff"), "height flatters round, not oblong");
  assert.ok(rank(oblong, "bob") < rank(round, "bob"), "a bob adds width for oblong, not round");
  assert.ok(rank(round, "long-layers") < rank(oblong, "long-layers"));
  for (const r of suggestHair(prof("oval"))) assert.ok(r.score >= 35 && r.score <= 98);
  const top = suggestHair(prof("heart"))[0];
  assert.ok(top.reasons.length > 0 && top.reasons[0].length > 10);
});

test("hair: your hair type, thinness, hairline and effort all matter", () => {
  const coily = suggestHair(prof("oval", { hairType: "coily" }));
  assert.ok(rank(coily, "short-natural") < rank(coily, "side-part"), "natural styles beat straight-hair styles on coily hair");
  const sidePart = coily.find((r) => r.item.id === "side-part")!;
  assert.ok(sidePart.cautions.some((c) => /straighten/.test(c)));
  const thin = suggestHair(prof("oval", { density: "thin" }));
  assert.ok(thin.find((r) => r.item.id === "quiff")!.score < suggestHair(prof("oval")).find((r) => r.item.id === "quiff")!.score);
  const receding = suggestHair(prof("oval", { receding: true }));
  assert.ok(receding.find((r) => r.item.id === "slick-back")!.cautions.some((c) => /hairline/.test(c)));
  const lazy = suggestHair(prof("oval", { maintenance: 1 }));
  assert.ok(lazy.find((r) => r.item.id === "quiff")!.score < lazy.find((r) => r.item.id === "buzz")!.score);
  assert.ok(suggestHair(prof("oval", { length: "short" })).find((r) => r.item.id === "long-layers")!.cautions.some((c) => /months/.test(c)));
});

test("hair: asks for what is missing", () => {
  assert.deepEqual([...suggestHair(prof(null)).needs!].sort(), ["face shape", "hair type"]);
  assert.deepEqual(suggestHair(prof("oval", { hairType: "wavy" })).needs, []);
});

test("beards: growth and face shape", () => {
  const patchy = suggestBeards(prof("oval", { beardGrowth: "patchy" }));
  assert.ok(rank(patchy, "goatee") < rank(patchy, "full"));
  assert.ok(patchy.find((r) => r.item.id === "full")!.cautions.some((c) => /even, full growth/.test(c)));
  assert.ok(rank(suggestBeards(prof("round", { beardGrowth: "full" })), "goatee") < rank(suggestBeards(prof("oblong", { beardGrowth: "full" })), "goatee"));
  assert.ok(suggestBeards(prof("oblong", { beardGrowth: "full" })).find((r) => r.item.id === "chin-strap")!.cautions.length > 0);
  assert.deepEqual([...suggestBeards(prof(null)).needs!].sort(), ["beard growth", "face shape"]);
});

test("glasses: classic face-shape guidance, softened by your colouring", () => {
  const round = suggestFrames(prof("round")), square = suggestFrames(prof("square")), oblong = suggestFrames(prof("oblong"));
  assert.ok(rank(round, "rectangular") < rank(round, "round"), "angles for a round face");
  assert.ok(rank(square, "round") < rank(square, "rectangular"), "curves for a square jaw");
  assert.ok(rank(oblong, "oversized") < rank(oblong, "rectangular"));
  const soft = suggestFrames(prof("oval", {}, "soft-summer")), vivid = suggestFrames(prof("oval", {}, "bright-winter"));
  assert.ok(soft.find((r) => r.item.id === "rimless")!.score > vivid.find((r) => r.item.id === "rimless")!.score);
  assert.ok(vivid.find((r) => r.item.id === "square")!.score > soft.find((r) => r.item.id === "square")!.score);
  assert.deepEqual(suggestFrames(prof(null)).needs, ["face shape"]);
});

test("frame colours follow warm vs cool seasons", () => {
  const warm = frameColours("true-autumn"), cool = frameColours("true-winter"), none = frameColours(null);
  assert.ok(warm.colours.some((c) => /tortoise/i.test(c.name)));
  assert.ok(cool.colours.some((c) => c.name === "Black") && !cool.colours.some((c) => /tortoise/i.test(c.name)));
  assert.notDeepEqual(warm.colours, cool.colours);
  assert.ok(/colour analysis/i.test(none.note));
  for (const l of [warm, cool, none, frameColours("light-summer"), frameColours("bright-spring")]) { assert.ok(l.colours.length >= 5); for (const c of l.colours) assert.match(c.hex, /^#[0-9a-f]{6}$/i); }
});

test("barber card has the script, your details and upkeep", () => {
  const t = barberText(prof("oval", { hairType: "wavy", density: "thin" }), "hair", "textured-crop");
  assert.match(t, /Textured crop/);
  assert.match(t, /Ask for:/);
  assert.match(t, /wavy hair, thin density, oval face shape/);
  assert.match(t, /every 5 weeks/);
  const b = barberText(prof("round", { beardGrowth: "patchy" }), "beard", "goatee");
  assert.match(b, /Goatee/); assert.match(b, /patchy growth/);
  assert.equal(barberText(prof("oval"), "hair", "nope"), "");
});

test("illustration paths are well-formed for every shape and style", () => {
  for (const f of FACE_SHAPES) {
    const d = headPath(f);
    assert.ok(d.startsWith("M") && d.endsWith("Z") && !bad(d), f);
    const a = anchors(f);
    assert.ok(a.topY < a.hairlineY && a.hairlineY < a.eyeY && a.eyeY < a.noseY && a.noseY < a.mouthY && a.mouthY < a.chinY, `${f} features ordered`);
    assert.ok(a.chinY < 330, "chin stays on the canvas");
    for (const h of HAIRSTYLES) {
      const s = hairShapes(h.illus, f);
      for (const p of [...s.back, ...s.front, ...s.strands, ...s.fadeBands.map((b) => b.d)]) assert.ok(!bad(p), `${h.id}/${f}: ${p.slice(0, 60)}`);
      assert.ok(s.front.length >= 1, `${h.id} has a front layer`);
      for (const c of s.curls) assert.ok(isFinite(c.x) && isFinite(c.y) && c.r > 0);
      const pl = partLine(h.illus, f); if (pl) assert.ok(!bad(pl));
    }
    for (const kind of ["none", "stubble", "short", "full", "goatee", "vandyke", "circle", "strap"] as BeardKind[]) {
      const s = beardShapes(kind, 0.6, f);
      for (const p of [...s.fills.map((x) => x.d), ...s.lines]) assert.ok(!bad(p), `${kind}/${f}`);
      assert.equal(s.fills.length + s.lines.length > 0, kind !== "none");
    }
  }
  assert.ok(!bad(bodyPath()));
  assert.ok(FACE_PARAMS.oblong.L > FACE_PARAMS.round.L && FACE_PARAMS.round.w > FACE_PARAMS.oblong.w);
  assert.ok(FACE_PARAMS.heart.jw < FACE_PARAMS.heart.fw && FACE_PARAMS.square.jw > FACE_PARAMS.heart.jw);
});

test("frames: every style draws two lenses at the right size and place", () => {
  for (const f of FRAMES) {
    const g = framePaths(f.id, 150, 160, 190);
    assert.equal(g.lenses.length, 2, f.id);
    for (const p of [...g.lenses, g.bridge, ...g.arms, g.brow ?? ""]) assert.ok(!bad(p), `${f.id}: ${p.slice(0, 50)}`);
    assert.ok(g.lensW > 0 && g.lensH > 0 && g.thickness > 0);
    assert.ok(g.lensW * 2 < 190, "two lenses fit inside the frame width");
  }
  assert.ok(framePaths("rimless", 0, 0, 100).thickness < framePaths("square", 0, 0, 100).thickness);
  assert.ok(framePaths("browline", 0, 0, 100).brow);
});

test("glasses placement from landmarks", () => {
  const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  lm[234] = { x: 100, y: 300 }; lm[454] = { x: 500, y: 300 };
  lm[468] = { x: 220, y: 280 }; lm[473] = { x: 380, y: 280 };
  const p = glassesPlacement(lm)!;
  assert.ok(Math.abs(p.cx - 300) < 1e-9 && Math.abs(p.width - 380) < 1e-9 && p.angle === 0);
  assert.ok(p.cy > 280 && p.cy < 290);
  lm[473] = { x: 380, y: 300 }; // right eye lower in the image → head tilted
  assert.ok(glassesPlacement(lm)!.angle > 0);
  assert.equal(glassesPlacement([]), null);
  const degenerate = Array.from({ length: 478 }, () => ({ x: 5, y: 5 }));
  assert.equal(glassesPlacement(degenerate), null);
});
