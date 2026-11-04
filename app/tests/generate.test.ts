import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PROFILE, normalizeProfile } from "../lib/style/profile";
import { NO_TASTE, buildTaste, generate, layerNeed, parseIntent, pairKey, reviewCloset, type Context, type GItem } from "../lib/style/generate";

const profile = normalizeProfile({ ...EMPTY_PROFILE, color: { ...EMPTY_PROFILE.color, season: "soft-autumn" }, body: { ...EMPTY_PROFILE.body, shoulderHip: "broader-shoulders", source: "self" } });
let n = 0;
const mk = (category: string, name: string, colorHex: string, extra: Partial<GItem> = {}): GItem => ({
  id: `i${++n}`, category, name, colorHex, colorName: name.split(" ")[0], fit: "regular", formality: 1, pattern: "solid", wears: 2, lastWorn: null, season: "all", ...extra,
});
const ctx = (over: Partial<Context> = {}): Context => ({ today: "2026-11-03", ...over });

function closet() {
  n = 0;
  return [
    mk("Tops", "Cream knit", "#ede3d0", { formality: 2 }), mk("Tops", "Rust tee", "#b4552d", { fit: "fitted" }), mk("Tops", "Olive shirt", "#6b6b3a", { formality: 2 }),
    mk("Tops", "White tee", "#f6f4ef", { fit: "fitted" }), mk("Tops", "Grey sweat", "#8a8d91", { fit: "oversized", season: "cool" }),
    mk("Bottoms", "Indigo jeans", "#2d3a55", { fit: "straight" }), mk("Bottoms", "Khaki chinos", "#b9a57c", { fit: "slim", formality: 2 }), mk("Bottoms", "Black trousers", "#1b1b1d", { fit: "wide", formality: 3 }),
    mk("Outerwear", "Camel coat", "#b88a5b", { formality: 3, season: "cool" }), mk("Outerwear", "Denim jacket", "#4a6384"), mk("Outerwear", "Olive overshirt", "#6b6b3a", { formality: 2 }),
    mk("Shoes", "White sneakers", "#f2f0ec"), mk("Shoes", "Brown loafers", "#5a3a28", { formality: 3 }), mk("Shoes", "Black boots", "#1a1a1a", { formality: 3 }),
    mk("Bags", "Tan tote", "#a9744a"),
  ];
}

test("generates distinct, scored outfits from owned items only", () => {
  const c = closet();
  const out = generate(c, profile, NO_TASTE, ctx(), 8);
  assert.ok(out.length >= 6);
  const ids = new Set(c.map((i) => i.id));
  for (const g of out) {
    assert.ok(g.items.every((i) => ids.has(i.id)), "only owned items");
    assert.ok(g.score >= 35 && g.score <= 98);
    assert.ok(g.items.some((i) => i.category === "Tops") && g.items.some((i) => i.category === "Bottoms"));
  }
  assert.equal(new Set(out.map((g) => g.key)).size, out.length, "no duplicates");
  const cores = out.map((g) => g.items[0].id + g.items[1].id);
  assert.equal(new Set(cores).size, cores.length, "diversity: no repeated top+bottom core");
});

test("anchor piece is always included", () => {
  const c = closet();
  const anchor = c.find((i) => i.name === "Olive overshirt")!;
  const out = generate(c, profile, NO_TASTE, ctx({ must: [anchor.id] }), 6);
  assert.ok(out.length >= 3);
  for (const g of out) assert.ok(g.items.some((i) => i.id === anchor.id));
});

test("a bag anchor pulls a bag into the outfit", () => {
  const c = closet();
  const tote = c.find((i) => i.category === "Bags")!;
  const out = generate(c, profile, NO_TASTE, ctx({ must: [tote.id] }), 3);
  assert.ok(out.length > 0);
  for (const g of out) assert.ok(g.items.some((i) => i.id === tote.id));
});

test("weather: cold requires a layer, hot skips it and avoids heavy 'cool' pieces", () => {
  const c = closet();
  assert.equal(layerNeed({ temp: 8 }), "required");
  assert.equal(layerNeed({ temp: 17 }), "welcome");
  assert.equal(layerNeed({ temp: 28 }), "skip");
  for (const g of generate(c, profile, NO_TASTE, ctx({ weather: { temp: 8 } }), 8)) assert.ok(g.items.some((i) => i.category === "Outerwear"));
  const hot = generate(c, profile, NO_TASTE, ctx({ weather: { temp: 30 } }), 8);
  for (const g of hot) assert.ok(!g.items.some((i) => i.category === "Outerwear"));
  assert.ok(hot.slice(0, 4).every((g) => !g.items.some((i) => i.season === "cool")), "no heavy pieces at the top in the heat");
});

test("occasion target changes what comes first", () => {
  const c = closet();
  const avg = (g: { items: GItem[] }) => g.items.reduce((a, i) => a + i.formality!, 0) / g.items.length;
  const dressy = generate(c, profile, NO_TASTE, ctx({ target: 3 }), 3);
  const casual = generate(c, profile, NO_TASTE, ctx({ target: 1 }), 3);
  const m = (l: typeof dressy) => l.reduce((a, g) => a + avg(g), 0) / l.length;
  assert.ok(m(dressy) > m(casual), `${m(dressy)} vs ${m(casual)}`);
});

test("rotation: recently worn pieces rank lower; rediscover favours unworn ones", () => {
  const c = closet();
  const best = generate(c, profile, NO_TASTE, ctx(), 1)[0];
  const worn = c.map((i) => (best.items.some((b) => b.id === i.id) ? { ...i, lastWorn: "2026-11-02" } : i));
  const after = generate(worn, profile, NO_TASTE, ctx(), 1)[0];
  assert.notEqual(after.key, best.key, "yesterday's outfit isn't suggested again first");
  const fresh = c.map((i) => (i.name === "Denim jacket" ? { ...i, wears: 0 } : { ...i, wears: 6 }));
  const re = generate(fresh, profile, NO_TASTE, ctx({ rediscover: true, weather: { temp: 17 } }), 3);
  assert.ok(re.some((g) => g.items.some((i) => i.name === "Denim jacket")));
  assert.ok(re.some((g) => g.note.some((x) => /haven’t worn/.test(x))));
});

test("taste: a disliked pairing is avoided, a liked one surfaces", () => {
  const c = closet();
  const top = generate(c, profile, NO_TASTE, ctx(), 1)[0];
  const a = top.items[0], b = top.items[1];
  const taste = buildTaste([{ itemIds: [a.id, b.id], rating: -1, tags: ["Don’t like this pairing"] }], new Set(c.map((i) => i.id)));
  assert.ok(taste.pair[pairKey(a.id, b.id)] < 0);
  const after = generate(c, profile, taste, ctx(), 3);
  assert.ok(!(after[0].items.some((i) => i.id === a.id) && after[0].items.some((i) => i.id === b.id)));
  const liked = buildTaste([{ itemIds: [c[0].id, c[5].id], rating: 1 }], new Set(c.map((i) => i.id)));
  assert.ok(liked.pair[pairKey(c[0].id, c[5].id)] > 0 && liked.item[c[0].id] > 0);
  assert.deepEqual(buildTaste([{ itemIds: ["gone"], rating: 1 }], new Set(c.map((i) => i.id))), { item: {}, pair: {} });
});

test("dresses form their own base; missing categories don't crash", () => {
  n = 0;
  const only = [mk("Dresses", "Rust dress", "#b4552d"), mk("Shoes", "Brown loafers", "#5a3a28"), mk("Outerwear", "Camel coat", "#b88a5b")];
  const out = generate(only, profile, NO_TASTE, ctx({ weather: { temp: 10 } }), 5);
  assert.ok(out.length >= 1 && out[0].items.some((i) => i.category === "Dresses"));
  assert.deepEqual(generate([], profile, NO_TASTE, ctx(), 5), []);
  assert.deepEqual(generate([mk("Tops", "Tee", "#ffffff")], profile, NO_TASTE, ctx(), 5), []);
});

test("colour request: 'something blue' surfaces outfits with blue when available", () => {
  const c = closet();
  const out = generate(c, profile, NO_TASTE, ctx({ onlyColourNear: 265 }), 4);
  assert.ok(out.length > 0);
});

test("fast enough on a 110-piece closet", () => {
  n = 0;
  const big: GItem[] = [];
  const hex = (i: number) => "#" + (((i * 2654435761) >>> 8) & 0xffffff).toString(16).padStart(6, "0");
  for (let i = 0; i < 40; i++) big.push(mk("Tops", `Top ${i}`, hex(i)));
  for (let i = 0; i < 20; i++) big.push(mk("Bottoms", `Bottom ${i}`, hex(i + 50)));
  for (let i = 0; i < 12; i++) big.push(mk("Outerwear", `Layer ${i}`, hex(i + 90)));
  for (let i = 0; i < 12; i++) big.push(mk("Shoes", `Shoe ${i}`, hex(i + 120)));
  for (let i = 0; i < 6; i++) big.push(mk("Bags", `Bag ${i}`, hex(i + 150)));
  const t = Date.now();
  const out = generate(big, profile, NO_TASTE, ctx({ weather: { temp: 15 }, withBag: true }), 12);
  const ms = Date.now() - t;
  assert.equal(out.length, 12);
  assert.ok(ms < 2500, `took ${ms}ms`);
});

test("intent parser: occasion, dressiness, weather, anchors, colours", () => {
  const c = closet();
  assert.equal(parseIntent("Dinner date, a bit dressy", c).key, "date");
  assert.ok(parseIntent("Dinner date, a bit dressy", c).target! > 2.5);
  assert.equal(parseIntent("work tomorrow", c).key, "work");
  assert.equal(parseIntent("brunch with friends", c).key, "casual");
  assert.ok(parseIntent("cold and rainy brunch", c).weather!.rain);
  assert.ok(parseIntent("cold and rainy brunch", c).weather!.temp < 12);
  assert.equal(parseIntent("hot day", c).weather!.temp, 32);
  const a = parseIntent("something with my olive overshirt", c);
  assert.equal(c.find((i) => i.id === a.must[0])?.name, "Olive overshirt");
  assert.equal(parseIntent("nothing in particular", c).key, "def");
  assert.ok(parseIntent("something blue for lunch", c).colourHue != null);
});

test("closet review: gentle triage", () => {
  const items = [
    mk("Tops", "Worn a lot", "#b4552d", { wears: 12 }),
    mk("Tops", "Never worn but lovely", "#6b6b3a", { wears: 0, createdAt: "2026-10-30 10:00:00" }),
    mk("Tops", "Old and off palette", "#00e6e6", { wears: 0, createdAt: "2026-01-01 10:00:00" }),
  ];
  const v = Object.fromEntries(reviewCloset(items, profile, "2026-11-03").map((r) => [r.id, r.verdict]));
  assert.equal(v[items[0].id], "keep");
  assert.ok(["keep", "restyle"].includes(v[items[1].id]));
  assert.equal(v[items[2].id], "let-go");
});
