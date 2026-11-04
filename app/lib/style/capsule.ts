// Capsule planning: pick the few pieces that make the most good outfits, plan trips day by day,
// and find the one purchase that would unlock the most. Pure TypeScript, no DOM or network.
import { deltaE, hexToLab, traits } from "./color";
import { generate, NO_TASTE, type Context, type GItem, type Taste, type Weather } from "./generate";
import type { Profile } from "./profile";
import { itemFit, outfitFit } from "./score";
import { seasonByKey } from "./seasons";
import { nameColor } from "./colornames";
import { matchOwned, unlocks } from "../shop/rank";
import type { Piece } from "../shop/types";

const GOOD = 78;
const CATS = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags"] as const;
type Cat = (typeof CATS)[number];

/* ------------------------------------------------------------------ goals */

export type GoalKey = "trip" | "work" | "minimal" | "college" | "custom";
export type Quota = Partial<Record<Cat, number>>;

export const GOALS: { key: GoalKey; label: string; blurb: string; target?: number }[] = [
  { key: "trip", label: "Trip", blurb: "Pack light, outfit every day", target: 1.8 },
  { key: "work", label: "Work week", blurb: "5 polished days from a few pieces", target: 2.6 },
  { key: "minimal", label: "Minimal wardrobe", blurb: "Your best 30 pieces, all year", target: 2 },
  { key: "college", label: "Everyday / college", blurb: "Easy, casual rotation", target: 1.3 },
  { key: "custom", label: "Custom", blurb: "Choose the number of pieces" },
];

/** How many of each category a goal needs. */
export function quotasFor(goal: GoalKey, opts: { days?: number; size?: number } = {}): Quota {
  const days = Math.max(1, Math.min(30, opts.days ?? 5));
  switch (goal) {
    case "trip": {
      const tops = Math.min(8, Math.ceil(days / 2) + 1), bottoms = Math.min(5, Math.ceil(days / 3) + 1);
      return { Tops: tops, Bottoms: bottoms, Outerwear: days >= 4 ? 2 : 1, Shoes: days >= 7 ? 3 : 2, Bags: 1 };
    }
    case "work": return { Tops: 5, Bottoms: 3, Outerwear: 2, Shoes: 2, Bags: 1 };
    case "minimal": return { Tops: 9, Bottoms: 6, Outerwear: 5, Shoes: 4, Bags: 2, Dresses: 2 };
    case "college": return { Tops: 6, Bottoms: 4, Outerwear: 2, Shoes: 2, Bags: 1 };
    default: {
      const n = Math.max(4, Math.min(40, opts.size ?? 12));
      return { Tops: Math.max(1, Math.round(n * 0.38)), Bottoms: Math.max(1, Math.round(n * 0.25)), Outerwear: Math.max(0, Math.round(n * 0.14)), Shoes: Math.max(1, Math.round(n * 0.14)), Bags: n >= 10 ? 1 : 0 };
    }
  }
}
export const quotaTotal = (q: Quota) => Object.values(q).reduce((a, n) => a + (n ?? 0), 0);

export type CapsuleConfig = {
  goal: GoalKey;
  name: string;
  quota: Quota;
  target?: number;
  weather?: Weather | null;
  pinned: string[];
  excluded: string[];
};

/* ------------------------------------------------------------------ building */

function weatherOK(i: GItem, w?: Weather | null) {
  if (!w) return true;
  if (i.season === "cool" && w.temp > 24) return false;
  if (i.season === "warm" && w.temp < 12) return false;
  return true;
}

export type CapsuleStats = { pieces: number; outfits: number; perPiece: number; palette: string[] };

/** Exact count of good, distinct outfits that can be made from exactly these pieces. */
export function countOutfits(pieces: GItem[], profile: Profile, target?: number, weather?: Weather | null, cap = 4000): number {
  const by = (c: string) => pieces.filter((p) => p.category === c);
  const tops = by("Tops"), bottoms = by("Bottoms"), dresses = by("Dresses"), outers = by("Outerwear"), shoes = by("Shoes");
  const layers: (GItem | null)[] = !outers.length ? [null] : weather && weather.temp <= 14 ? outers : weather && weather.temp > 20 ? [null] : [null, ...outers];
  const shoeOpts: (GItem | null)[] = shoes.length ? shoes : [null];
  let n = 0, evals = 0;
  const bases: GItem[][] = [];
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  for (const d of dresses) bases.push([d]);
  for (const base of bases) for (const s of shoeOpts) for (const o of layers) {
    if (++evals > cap) return n;
    const items = [...base, ...(s ? [s] : []), ...(o ? [o] : [])];
    if (outfitFit(items, profile, target).score >= GOOD) n++;
  }
  return n;
}

export function buildCapsule(all: GItem[], profile: Profile, taste: Taste, cfg: CapsuleConfig): { ids: string[]; stats: CapsuleStats } {
  const excluded = new Set(cfg.excluded);
  const pool = all.filter((i) => !excluded.has(i.id) && weatherOK(i, cfg.weather) && (CATS as readonly string[]).includes(i.category));
  const pinned = pool.filter((i) => cfg.pinned.includes(i.id));

  // shortlist per category: best personal fit first (keeps the search small and sensible), pinned always in
  const quota = cfg.quota;
  const short = (c: Cat, n: number) => {
    const list = pool.filter((i) => i.category === c).map((i) => ({ i, s: itemFit(i, profile).score + (taste.item[i.id] ?? 0) + Math.min(6, i.wears) * 0.3 }));
    list.sort((a, b) => b.s - a.s);
    const take = list.slice(0, Math.max(n * 3, 10)).map((x) => x.i);
    for (const p of pinned.filter((p) => p.category === c)) if (!take.includes(p)) take.push(p);
    return take;
  };
  const T = short("Tops", quota.Tops ?? 0), B = short("Bottoms", quota.Bottoms ?? 0), O = short("Outerwear", quota.Outerwear ?? 0), S = short("Shoes", quota.Shoes ?? 0), G = short("Bags", quota.Bags ?? 0), D = short("Dresses", quota.Dresses ?? 0);

  // pair compatibility tables (computed once)
  const pairScore = new Map<string, number>();
  const key = (...x: GItem[]) => x.map((i) => i.id).join("|");
  const pair = (t: GItem, b: GItem) => { const k = key(t, b); let v = pairScore.get(k); if (v == null) { v = outfitFit([t, b], profile, cfg.target).score + (taste.pair[[t.id, b.id].sort().join("|")] ?? 0); pairScore.set(k, v); } return v; };
  const ext = new Map<string, number>();
  const withExtra = (t: GItem, b: GItem, x: GItem) => { const k = key(t, b, x); let v = ext.get(k); if (v == null) { v = outfitFit([t, b, x], profile, cfg.target).score; ext.set(k, v); } return v; };

  const chosen = new Set<string>(pinned.map((p) => p.id));
  const inS = (xs: GItem[]) => xs.filter((x) => chosen.has(x.id));
  const value = () => {
    const ts = inS(T), bs = inS(B), os = inS(O), ss = inS(S);
    let v = 0;
    for (const t of ts) for (const b of bs) {
      if (pair(t, b) < GOOD) continue;
      let layers = 0, shoes = 0;
      for (const o of os) if (withExtra(t, b, o) >= GOOD - 2) layers++;
      for (const s of ss) if (withExtra(t, b, s) >= GOOD - 2) shoes++;
      v += 1 + 0.7 * Math.min(3, layers) + 0.5 * Math.min(3, shoes);
    }
    for (const d of inS(D)) { const ok = outfitFit([d], profile, cfg.target).score >= GOOD; if (ok) v += 1 + 0.4 * Math.min(3, ss.length); }
    // few colour families keeps a capsule cohesive
    const fams: number[] = [];
    for (const i of [...ts, ...bs, ...os]) { const t = traits(i.colorHex); if (!t.neutral && !fams.some((h) => Math.abs(h - t.h) < 25)) fams.push(t.h); }
    return v - Math.max(0, fams.length - 3) * 1.5;
  };

  const counts = (c: Cat) => pool.filter((i) => i.category === c && chosen.has(i.id)).length;
  const lists: Record<Cat, GItem[]> = { Tops: T, Bottoms: B, Outerwear: O, Shoes: S, Bags: G, Dresses: D };
  const order: Cat[] = ["Bottoms", "Tops", "Shoes", "Outerwear", "Dresses", "Bags"];
  const need = (c: Cat) => (quota[c] ?? 0) - counts(c);

  let guard = 0;
  while (order.some((c) => need(c) > 0 && lists[c].some((i) => !chosen.has(i.id))) && guard++ < 80) {
    const base = value();
    let best: { it: GItem; gain: number } | null = null;
    for (const c of order) {
      if (need(c) <= 0) continue;
      for (const it of lists[c]) {
        if (chosen.has(it.id)) continue;
        chosen.add(it.id);
        // tiny personal-fit tiebreak so empty-gain steps still pick well-suited pieces (and a bag/pair partner)
        const gain = value() - base + itemFit(it, profile).score * 0.004 + (taste.item[it.id] ?? 0) * 0.02 - (order.indexOf(c) * 0.0005);
        chosen.delete(it.id);
        if (!best || gain > best.gain) best = { it, gain };
      }
    }
    if (!best) break;
    chosen.add(best.it.id);
  }

  // one swap pass: replace a piece by an unchosen one if the capsule gets better
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (const c of order) {
      for (const cur of lists[c].filter((i) => chosen.has(i.id) && !cfg.pinned.includes(i.id))) {
        const base = value();
        chosen.delete(cur.id);
        let bestAlt: GItem | null = null, bestV = base;
        for (const alt of lists[c]) {
          if (chosen.has(alt.id) || alt.id === cur.id) continue;
          chosen.add(alt.id);
          const v = value();
          chosen.delete(alt.id);
          if (v > bestV + 0.01) { bestV = v; bestAlt = alt; }
        }
        if (bestAlt) { chosen.add(bestAlt.id); improved = true; } else chosen.add(cur.id);
      }
    }
    if (!improved) break;
  }

  const pieces = pool.filter((i) => chosen.has(i.id));
  const outfits = countOutfits(pieces, profile, cfg.target, cfg.weather);
  const palette: string[] = [];
  for (const p of pieces) if (!palette.some((h) => deltaE(hexToLab(h), hexToLab(p.colorHex)) < 14)) palette.push(p.colorHex);
  return { ids: pieces.map((p) => p.id), stats: { pieces: pieces.length, outfits, perPiece: pieces.length ? Math.round((outfits / pieces.length) * 10) / 10 : 0, palette: palette.slice(0, 8) } };
}

/* ------------------------------------------------------------------ day-by-day plan */

export type DayTag = "casual" | "smart" | "dressy";
export const TAG_TARGET: Record<DayTag, number> = { casual: 1.3, smart: 2.2, dressy: 2.9 };
export type Day = { date: string; tag: DayTag; weather?: Weather | null; itemIds: string[] };

const USAGE_WEIGHT: Record<string, number> = { Tops: 11, Dresses: 11, Bottoms: 4.5, Outerwear: 1, Shoes: 1.5, Bags: 0 };

/** One look per day from a fixed set of pieces, repeating as little as possible (tops least of all). */
export function planDays(pieces: GItem[], profile: Profile, taste: Taste, days: { date: string; tag: DayTag; weather?: Weather | null }[], keep: Record<string, string[]> = {}): Day[] {
  const usage: Record<string, number> = {};
  const lastWorn: Record<string, string> = {};
  const usedCore = new Set<string>();
  const out: Day[] = [];
  for (const d of days) {
    const fixed = keep[d.date];
    let ids: string[];
    if (fixed?.length && fixed.every((id) => pieces.some((p) => p.id === id))) ids = fixed;
    else {
      const live = pieces.map((p) => ({ ...p, wears: p.wears + (usage[p.id] ?? 0), lastWorn: lastWorn[p.id] ?? p.lastWorn }));
      const ctx: Context = { today: d.date, target: TAG_TARGET[d.tag], weather: d.weather ?? null };
      const cands = generate(live, profile, taste, ctx, 14);
      let best: { ids: string[]; adj: number } | null = null;
      for (const g of cands) {
        const core = g.items.filter((i) => i.category === "Tops" || i.category === "Bottoms" || i.category === "Dresses").map((i) => i.id).sort().join("|");
        const adj = g.score - g.items.reduce((a, i) => a + (usage[i.id] ?? 0) * (USAGE_WEIGHT[i.category] ?? 1), 0) - (usedCore.has(core) ? 40 : 0);
        if (!best || adj > best.adj) best = { ids: g.items.map((i) => i.id), adj };
      }
      ids = best?.ids ?? [];
    }
    const core = ids.filter((id) => { const p = pieces.find((x) => x.id === id); return p && ["Tops", "Bottoms", "Dresses"].includes(p.category); }).sort().join("|");
    usedCore.add(core);
    for (const id of ids) { usage[id] = (usage[id] ?? 0) + 1; lastWorn[id] = d.date; }
    out.push({ ...d, itemIds: ids });
  }
  return out;
}

export function tripDates(start: string, n: number): string[] {
  const d = new Date(start + "T12:00:00");
  return Array.from({ length: n }, (_, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; });
}

/* ------------------------------------------------------------------ coverage, redundancy, gaps */

export type CoverageDim = { key: string; label: string; score: number; good: number; hint?: string };

/** How well the closet covers different dressiness levels and weather. 0..1 per dimension. */
export function coverage(items: GItem[], profile: Profile, taste: Taste = NO_TASTE, today = "2026-01-01"): { dims: CoverageDim[]; overall: number } {
  const need = 8;
  const run = (ctx: Partial<Context>) => generate(items, profile, taste, { today, ...ctx }, 14).filter((g) => g.score >= GOOD - 3).length;
  const defs: [string, string, Partial<Context>, string][] = [
    ["casual", "Casual days", { target: 1.2 }, "relaxed everyday pieces"],
    ["smart", "Work / smart-casual", { target: 2.4 }, "smart tops, trousers or chinos"],
    ["dressy", "Dressy occasions", { target: 3 }, "dressier trousers, shirts and shoes"],
    ["cold", "Cold weather (≤10°C)", { weather: { temp: 8 }, target: 2 }, "warm layers"],
    ["mild", "Mild weather", { weather: { temp: 19 } }, ""],
    ["hot", "Hot weather (≥28°C)", { weather: { temp: 30 }, target: 1.5 }, "light, breathable pieces"],
  ];
  const dims = defs.map(([key, label, ctx, hint]) => {
    const good = items.length ? run(ctx) : 0;
    return { key, label, good, score: Math.min(1, good / need), hint };
  });
  return { dims, overall: dims.reduce((a, d) => a + d.score, 0) / dims.length };
}

export type Redundant = { category: string; ids: string[]; keep: string; why: string };

/** Near-identical pieces (same kind, nearly the same colour and cut). */
export function redundancy(items: GItem[], profile: Profile): Redundant[] {
  const out: Redundant[] = [];
  const seen = new Set<string>();
  for (const a of items) {
    if (seen.has(a.id)) continue;
    const group = items.filter((b) => b.category === a.category && (b.id === a.id || (deltaE(hexToLab(a.colorHex), hexToLab(b.colorHex)) < 11 && (a.fit || "") === (b.fit || "") && (a.pattern || "solid") === (b.pattern || "solid"))));
    if (group.length < 2) continue;
    group.forEach((g) => seen.add(g.id));
    const ranked = [...group].sort((x, y) => (y.wears - x.wears) || (itemFit(y, profile).score - itemFit(x, profile).score));
    out.push({ category: a.category, ids: group.map((g) => g.id), keep: ranked[0].id, why: `${group.length} near-identical ${(a.colorName || "").toLowerCase()} ${a.category.toLowerCase()} — you wear “${ranked[0].name}” most` });
  }
  return out;
}

const NOUN: Record<string, (fit: string, form: number) => string> = {
  Tops: (_f, form) => (form >= 3 ? "dress shirt" : form === 2 ? "shirt" : "tee"),
  Bottoms: (fit, form) => (fit === "wide" ? "wide trousers" : fit === "slim" ? "chinos" : form >= 3 ? "trousers" : "jeans"),
  Outerwear: (fit, form) => (form >= 3 ? "coat" : fit === "cropped" ? "cropped jacket" : "overshirt"),
  Shoes: (_f, form) => (form >= 3 ? "loafers" : "sneakers"),
  Bags: () => "tote",
};
const TEMPLATES: Record<string, { fit: string; form: number }[]> = {
  Tops: [{ fit: "fitted", form: 1 }, { fit: "regular", form: 2 }],
  Bottoms: [{ fit: "straight", form: 1 }, { fit: "slim", form: 2 }, { fit: "wide", form: 3 }],
  Outerwear: [{ fit: "regular", form: 2 }, { fit: "cropped", form: 1 }, { fit: "regular", form: 3 }],
  Shoes: [{ fit: "", form: 1 }, { fit: "", form: 3 }],
};

/** kind "new": the piece makes brand-new outfits (tops, bottoms). kind "works": it adds a layer/shoe option to outfits you already have. */
export type Gap = { piece: Piece; unlock: number; fit: number; perOutfit: string; kind: "new" | "works" };
const gapWeight = (g: Gap) => g.unlock * (g.kind === "new" ? 1 : 0.25);

/** The single purchases that would add the most good outfits to what you own, in colours that suit you. */
export function gapSuggestions(items: GItem[], profile: Profile, opts: { direction?: string; perCategory?: number } = {}): Gap[] {
  const season = seasonByKey(profile.color.season);
  const colours = [...(season ? [...season.best.slice(0, 5), ...season.neutrals] : ["#26324d", "#b9a57c", "#1b1b1d", "#ede3d0", "#6b6b3a", "#b4552d", "#8a8d91"])];
  const who = opts.direction === "Menswear" ? "men " : opts.direction === "Womenswear" ? "women " : "";
  const out: Gap[] = [];
  for (const [cat, tpls] of Object.entries(TEMPLATES)) {
    const found: Gap[] = [];
    for (const tpl of tpls) for (const hex of colours) {
      const cand = { category: cat, colorHex: hex, fit: tpl.fit, formality: tpl.form, pattern: "solid" } as GItem;
      const f = itemFit(cand, profile).score;
      if (f < 74) continue;
      const colorName = nameColor(hex);
      const noun = NOUN[cat](tpl.fit, tpl.form);
      const piece: Piece = { id: `gap-${cat}-${hex}-${tpl.fit}-${tpl.form}`, name: `${colorName} ${noun}`, category: cat, colorName, colorHex: hex, pattern: "solid", fit: tpl.fit, formality: tpl.form, query: `${who}${colorName.toLowerCase()} ${tpl.fit && tpl.fit !== "regular" ? tpl.fit + " " : ""}${noun}` };
      if (matchOwned(piece, items)) continue; // you already have something like it
      const unlock = unlocks(cand, items, profile, GOOD);
      if (unlock <= 0) continue;
      found.push({ piece, unlock, fit: f, perOutfit: `${colorName} ${noun}`, kind: cat === "Tops" || cat === "Bottoms" ? "new" : "works" });
    }
    // best few per category, with different colours
    found.sort((a, b) => gapWeight(b) - gapWeight(a) || b.fit - a.fit);
    const picked: Gap[] = [];
    for (const g of found) { if (picked.length >= (opts.perCategory ?? 2)) break; if (!picked.some((p) => deltaE(hexToLab(p.piece.colorHex), hexToLab(g.piece.colorHex)) < 18)) picked.push(g); }
    out.push(...picked);
  }
  return out.sort((a, b) => gapWeight(b) - gapWeight(a));
}
