import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PROFILE, normalizeProfile } from "../lib/style/profile";
import { NO_TASTE, type GItem } from "../lib/style/generate";
import { GOALS, buildCapsule, countOutfits, coverage, gapSuggestions, planDays, quotaTotal, quotasFor, redundancy, tripDates, type CapsuleConfig } from "../lib/style/capsule";

const profile = normalizeProfile({ ...EMPTY_PROFILE, color: { ...EMPTY_PROFILE.color, season: "soft-autumn" }, body: { ...EMPTY_PROFILE.body, shoulderHip: "broader-shoulders", source: "self" } });
let n = 0;
const mk = (category: string, name: string, colorHex: string, extra: Partial<GItem> = {}): GItem => ({
  id: `i${++n}`, category, name, colorHex, colorName: name.split(" ")[0], fit: "regular", formality: 1, pattern: "solid", wears: 2, lastWorn: null, season: "all", ...extra,
});

function bigCloset(): GItem[] {
  n = 0;
  const tops: [string, string, number, string?][] = [["Cream knit", "#ede3d0", 2], ["Rust tee", "#b4552d", 1, "fitted"], ["Olive shirt", "#6b6b3a", 2], ["White tee", "#f6f4ef", 1, "fitted"], ["Grey sweat", "#8a8d91", 1, "oversized"],
    ["Camel knit", "#b88a5b", 2], ["Sage tee", "#9aa888", 1, "fitted"], ["Navy shirt", "#26324d", 2], ["Mustard tee", "#c79a2c", 1, "fitted"], ["Charcoal knit", "#3a3b3e", 2], ["Sky shirt", "#a9c1de", 2], ["Black tee", "#1b1b1d", 1, "fitted"]];
  const bottoms: [string, string, number, string][] = [["Indigo jeans", "#2d3a55", 1, "straight"], ["Khaki chinos", "#b9a57c", 2, "slim"], ["Black trousers", "#1b1b1d", 3, "wide"], ["Olive cargo", "#6b6b3a", 1, "straight"], ["Cream trousers", "#ede3d0", 2, "wide"], ["Brown chinos", "#5a3a28", 2, "slim"], ["Grey trousers", "#8a8d91", 3, "slim"], ["Light jeans", "#7f9bbd", 1, "wide"]];
  const outers: [string, string, number][] = [["Camel coat", "#b88a5b", 3], ["Denim jacket", "#4a6384", 1], ["Olive overshirt", "#6b6b3a", 2], ["Black blazer", "#1b1b1d", 3], ["Tan trench", "#b9a57c", 3]];
  const shoes: [string, string, number][] = [["White sneakers", "#f2f0ec", 1], ["Brown loafers", "#5a3a28", 3], ["Black boots", "#1a1a1a", 3], ["Tan sneakers", "#a9744a", 1]];
  return [
    ...tops.map(([nm, h, f, fit]) => mk("Tops", nm, h, { formality: f, fit: fit ?? "regular" })),
    ...bottoms.map(([nm, h, f, fit]) => mk("Bottoms", nm, h, { formality: f, fit })),
    ...outers.map(([nm, h, f]) => mk("Outerwear", nm, h, { formality: f })),
    ...shoes.map(([nm, h, f]) => mk("Shoes", nm, h, { formality: f })),
    mk("Bags", "Tan tote", "#a9744a"), mk("Bags", "Black bag", "#1b1b1d", { formality: 3 }),
  ];
}
const cfg = (over: Partial<CapsuleConfig> = {}): CapsuleConfig => ({ goal: "work", name: "Test", quota: quotasFor("work"), target: 2.6, pinned: [], excluded: [], ...over });

test("quotas scale with the goal and trip length", () => {
  assert.equal(GOALS.length, 5);
  assert.ok(quotaTotal(quotasFor("minimal")) >= 25);
  const short = quotasFor("trip", { days: 3 }), long = quotasFor("trip", { days: 10 });
  assert.ok(quotaTotal(long) > quotaTotal(short));
  assert.ok((long.Tops ?? 0) <= 8, "never packs more than 8 tops");
  assert.equal(quotaTotal(quotasFor("custom", { size: 12 })) >= 10, true);
});

test("capsule respects quotas, pins and exclusions", () => {
  const c = bigCloset();
  const pin = c.find((i) => i.name === "Rust tee")!, out = c.find((i) => i.name === "White tee")!;
  const q = quotasFor("work");
  const r = buildCapsule(c, profile, NO_TASTE, cfg({ pinned: [pin.id], excluded: [out.id] }));
  const picked = c.filter((i) => r.ids.includes(i.id));
  assert.ok(r.ids.includes(pin.id), "pinned piece is in");
  assert.ok(!r.ids.includes(out.id), "excluded piece is out");
  for (const cat of ["Tops", "Bottoms", "Outerwear", "Shoes", "Bags"] as const) assert.ok(picked.filter((i) => i.category === cat).length <= (q[cat] ?? 0), cat);
  assert.ok(picked.length >= 10 && picked.length <= quotaTotal(q));
  assert.ok(r.stats.outfits > 10, `outfits ${r.stats.outfits}`);
  assert.equal(r.stats.pieces, picked.length);
  assert.ok(r.stats.palette.length >= 1);
});

test("the capsule beats an arbitrary selection of the same size", () => {
  const c = bigCloset();
  const r = buildCapsule(c, profile, NO_TASTE, cfg());
  const same = r.ids.length;
  // the worst-matching pieces: neon-ish, formality-mismatched — pick the first `same` pieces in a scrambled order
  const scrambled = [...c].sort((a, b) => ((a.colorHex > b.colorHex ? 1 : -1))).slice(0, same);
  const arbitrary = countOutfits(scrambled, profile, 2.6);
  assert.ok(r.stats.outfits >= arbitrary, `${r.stats.outfits} vs ${arbitrary}`);
});

test("weather: a hot trip leaves heavy 'cool' pieces out", () => {
  const c = bigCloset().map((i) => (i.name === "Camel coat" || i.name === "Grey sweat" ? { ...i, season: "cool" } : i));
  const r = buildCapsule(c, profile, NO_TASTE, cfg({ goal: "trip", quota: quotasFor("trip", { days: 7 }), weather: { temp: 31 } }));
  for (const id of r.ids) assert.notEqual(c.find((i) => i.id === id)!.season, "cool");
});

test("trip plan: a look per day, no repeated top+bottom, few repeated tops", () => {
  const c = bigCloset();
  const cap = buildCapsule(c, profile, NO_TASTE, cfg({ goal: "trip", quota: quotasFor("trip", { days: 6 }) }));
  const pieces = c.filter((i) => cap.ids.includes(i.id));
  const dates = tripDates("2026-12-01", 6);
  assert.deepEqual(dates.slice(0, 2), ["2026-12-01", "2026-12-02"]);
  const plan = planDays(pieces, profile, NO_TASTE, dates.map((d, k) => ({ date: d, tag: k === 4 ? "dressy" as const : "casual" as const, weather: { temp: 18 } })));
  assert.equal(plan.length, 6);
  for (const d of plan) assert.ok(d.itemIds.length >= 3, d.date);
  const cores = plan.map((d) => d.itemIds.filter((id) => ["Tops", "Bottoms"].includes(pieces.find((p) => p.id === id)?.category ?? "")).sort().join("|"));
  assert.equal(new Set(cores).size, cores.length, "no repeated top+bottom");
  const tops = plan.map((d) => d.itemIds.find((id) => pieces.find((p) => p.id === id)?.category === "Tops"));
  assert.ok(new Set(tops).size >= 4, `tops used: ${new Set(tops).size}`);
  for (const d of plan) for (const id of d.itemIds) assert.ok(pieces.some((p) => p.id === id), "only capsule pieces");
  const dressy = plan[4];
  const avg = (d: typeof dressy) => d.itemIds.reduce((a, id) => a + (pieces.find((p) => p.id === id)!.formality ?? 1), 0) / d.itemIds.length;
  assert.ok(avg(dressy) >= avg(plan[0]) - 0.01, "dressy day is at least as dressy");
});

test("trip plan keeps days the user fixed", () => {
  const c = bigCloset();
  const pieces = c.slice(0, 20);
  const fixed = pieces.filter((p) => ["Rust tee", "Indigo jeans", "White sneakers"].includes(p.name)).map((p) => p.id);
  const plan = planDays(pieces, profile, NO_TASTE, tripDates("2026-12-01", 3).map((d) => ({ date: d, tag: "casual" as const })), { "2026-12-02": fixed });
  assert.deepEqual(plan[1].itemIds, fixed);
});

test("coverage rates casual vs dressy vs weather", () => {
  const c = bigCloset();
  const cv = coverage(c, profile);
  assert.equal(cv.dims.length, 6);
  for (const d of cv.dims) assert.ok(d.score >= 0 && d.score <= 1);
  assert.ok(cv.overall > 0.4, String(cv.overall));
  const casualOnly = c.filter((i) => (i.formality ?? 1) === 1);
  const weak = coverage(casualOnly, profile);
  assert.ok(weak.dims.find((d) => d.key === "dressy")!.score <= cv.dims.find((d) => d.key === "dressy")!.score);
  assert.equal(coverage([], profile).overall, 0);
});

test("redundancy finds near-identical pieces and says which to keep", () => {
  const items = [
    mk("Tops", "White tee", "#f6f4ef", { fit: "fitted", wears: 20 }), mk("Tops", "Ivory tee", "#f4f2ee", { fit: "fitted", wears: 3 }), mk("Tops", "White tee 2", "#f5f3ee", { fit: "fitted", wears: 1 }),
    mk("Tops", "Rust tee", "#b4552d", { fit: "fitted" }), mk("Bottoms", "White trousers", "#f6f4ef", { fit: "wide" }),
  ];
  const r = redundancy(items, profile);
  assert.equal(r.length, 1);
  assert.equal(r[0].ids.length, 3);
  assert.equal(r[0].keep, items[0].id);
  assert.ok(/3 near-identical/.test(r[0].why));
});

test("gap suggestions: purchases that unlock outfits, not duplicates of what you own", () => {
  n = 0;
  const closet = [
    mk("Tops", "Cream knit", "#ede3d0", { formality: 2 }), mk("Tops", "Rust tee", "#b4552d", { fit: "fitted" }), mk("Tops", "Olive shirt", "#6b6b3a", { formality: 2 }),
    mk("Bottoms", "Indigo jeans", "#2d3a55", { fit: "straight" }), mk("Shoes", "White sneakers", "#f2f0ec"),
  ];
  const gaps = gapSuggestions(closet, profile, { direction: "Menswear" });
  assert.ok(gaps.length >= 2);
  for (const g of gaps) { assert.ok(g.unlock > 0); assert.ok(g.fit >= 74); assert.ok(g.piece.query.startsWith("men ")); }
  const w = (g: (typeof gaps)[number]) => g.unlock * (g.kind === "new" ? 1 : 0.25);
  assert.ok(w(gaps[0]) >= w(gaps[gaps.length - 1]), "sorted by weighted unlock");
  assert.ok(gaps.every((g) => g.kind === (["Tops", "Bottoms"].includes(g.piece.category) ? "new" : "works")));
  // with only one bottom owned, the biggest wins are bottoms (each pairs with 3 tops)
  assert.equal(gaps[0].piece.category, "Bottoms");
  // nothing it suggests is a near-copy of an owned piece
  for (const g of gaps) assert.ok(!closet.some((o) => o.category === g.piece.category && o.colorHex === g.piece.colorHex && o.fit === g.piece.fit));
  assert.deepEqual(gapSuggestions([], profile), []);
});
