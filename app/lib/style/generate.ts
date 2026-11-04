// Outfit generation from the clothes you own. Pure TypeScript: no DOM, no network.
import { hueGap, traits } from "./color";
import type { Profile } from "./profile";
import { outfitFit, itemFit, type Reason, type StyleItem } from "./score";

export type GItem = StyleItem & {
  id: string;
  name: string;
  season?: string;       // all | warm | cool
  wears: number;
  lastWorn: string | null;
  createdAt?: string;
};

export type Weather = { temp: number; rain?: boolean };

export type Context = {
  /** 1 casual … 3 dressy; undefined = no preference */
  target?: number;
  weather?: Weather | null;
  /** items that must be included */
  must?: string[];
  /** items that must not be used */
  exclude?: string[];
  /** only items whose colour family is this (e.g. from "something blue") */
  onlyColourNear?: number | null;
  /** today's date as YYYY-MM-DD (for the rotation penalty) */
  today: string;
  /** bias toward things worn least */
  rediscover?: boolean;
  /** include a bag when one exists */
  withBag?: boolean;
};

export type Taste = { item: Record<string, number>; pair: Record<string, number> };
export const NO_TASTE: Taste = { item: {}, pair: {} };
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export type Generated = { items: GItem[]; score: number; reasons: Reason[]; note: string[]; key: string };

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 86400000);

/** Do we need / want a layer at this temperature? */
export function layerNeed(w?: Weather | null): "required" | "welcome" | "skip" | "unknown" {
  if (!w) return "unknown";
  if (w.temp <= 14 || (w.rain && w.temp <= 18)) return "required";
  if (w.temp <= 20) return "welcome";
  return "skip";
}

function seasonPenalty(i: GItem, w?: Weather | null): number {
  if (!w) return 0;
  if (i.season === "warm" && w.temp < 14) return -10;
  if (i.season === "cool" && w.temp > 26) return -12;
  if (i.season === "cool" && w.temp > 22) return -5;
  if (i.season === "warm" && w.temp > 12 && w.temp < 20) return 2;
  return 0;
}

/** How recently / rarely something was worn → small nudge. */
function rotation(i: GItem, ctx: Context): { delta: number; note?: string } {
  let delta = 0;
  let note: string | undefined;
  if (i.lastWorn) {
    const d = daysBetween(i.lastWorn, ctx.today);
    if (d >= 0 && d <= 2) { delta -= 9; }
    else if (d >= 3 && d <= 6) delta -= 3;
  }
  if (ctx.rediscover) {
    if (i.wears === 0) { delta += 6; note = `Brings back ${i.name.toLowerCase() || "a piece"} you haven’t worn yet`; }
    else if (i.wears <= 2) delta += 3;
  }
  return { delta, note };
}

function tasteDelta(items: GItem[], taste: Taste) {
  let d = 0;
  for (const i of items) d += taste.item[i.id] ?? 0;
  d /= Math.max(1, items.length) / 1.5;
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) d += taste.pair[pairKey(items[a].id, items[b].id)] ?? 0;
  return Math.max(-18, Math.min(12, d));
}

type Cand = { items: GItem[]; base: number };

function usable(all: GItem[], ctx: Context) {
  const ex = new Set(ctx.exclude ?? []);
  return all.filter((i) => !ex.has(i.id));
}

export function generate(all: GItem[], profile: Profile, taste: Taste, ctx: Context, limit = 12): Generated[] {
  const pool = usable(all, ctx);
  const by = (c: string) => pool.filter((i) => i.category === c);
  const tops = by("Tops"), bottoms = by("Bottoms"), dresses = by("Dresses"), outers = by("Outerwear"), shoes = by("Shoes"), bags = by("Bags");
  const must = new Set(ctx.must ?? []);
  const layer = layerNeed(ctx.weather);

  const score = (items: GItem[]) => {
    const f = outfitFit(items, profile, ctx.target);
    let s = f.score;
    s += items.reduce((a, i) => a + seasonPenalty(i, ctx.weather), 0) / Math.max(1, items.length) * 1.5;
    // recent-wear penalties are averaged; the rediscover bonus is additive so one forgotten piece can lift a look
    const rot = items.map((i) => rotation(i, ctx).delta);
    s += rot.filter((d) => d < 0).reduce((a, d) => a + d, 0) / Math.max(1, items.length) * 1.2;
    s += Math.min(12, rot.filter((d) => d > 0).reduce((a, d) => a + d, 0) * 1.4);
    s += tasteDelta(items, taste);
    return { s, f };
  };
  const hasMust = (items: GItem[]) => [...must].every((id) => items.some((i) => i.id === id));
  // a bag is only added in the last stage, so a bag anchor must not be required earlier
  const bagIds = new Set(bags.map((b) => b.id));
  const hasMustBeforeBag = (items: GItem[]) => [...must].every((id) => bagIds.has(id) || items.some((i) => i.id === id));
  const wantBag = !!ctx.withBag || [...must].some((id) => bagIds.has(id));
  const keep = (list: Cand[], n: number) => list.sort((a, b) => b.base - a.base).slice(0, n);

  // stage 1: bases (top+bottom, or a dress)
  let bases: Cand[] = [];
  for (const t of tops) for (const b of bottoms) bases.push({ items: [t, b], base: score([t, b]).s });
  for (const d of dresses) bases.push({ items: [d], base: score([d]).s });
  // keep anything that satisfies a "must" so anchors are never pruned away
  const mustBases = bases.filter((c) => must.size && c.items.some((i) => must.has(i.id)));
  bases = keep(bases, 90);
  if (must.size) for (const c of mustBases) if (!bases.includes(c)) bases.push(c);

  // stage 2: shoes
  let withShoes: Cand[] = bases;
  if (shoes.length) {
    withShoes = [];
    for (const c of bases) for (const s of shoes) withShoes.push({ items: [...c.items, s], base: score([...c.items, s]).s });
    const mustS = withShoes.filter((c) => hasMustBeforeBag(c.items) && must.size);
    withShoes = keep(withShoes, 80);
    for (const c of mustS.slice(0, 40)) if (!withShoes.includes(c)) withShoes.push(c);
  }

  // stage 3: layer
  let full: Cand[] = [];
  const optionsFor = (c: Cand): GItem[][] => {
    const none = [c.items];
    const withL = outers.map((o) => [...c.items, o]);
    if (!outers.length) return none;
    if (layer === "required") return withL;
    if (layer === "skip") return none;
    return [...none, ...withL];
  };
  for (const c of withShoes) for (const items of optionsFor(c)) full.push({ items, base: score(items).s });
  full = full.filter((c) => hasMustBeforeBag(c.items));
  if (ctx.onlyColourNear != null) {
    // "something blue": keep outfits that feature that colour family, if any exist
    const hue = ctx.onlyColourNear;
    const featured = full.filter((c) => c.items.some((i) => { const t = traits(i.colorHex); return !t.neutral && hueGap(t.h, hue) < 45; }));
    if (featured.length) full = featured;
  }

  // stage 4: bag (only when asked and available)
  if (wantBag && bags.length) {
    const extra: Cand[] = [];
    for (const c of keep(full, 40)) for (const bg of bags) {
      if (must.size && [...must].some((id) => bagIds.has(id)) && ![...must].filter((id) => bagIds.has(id)).every((id) => id === bg.id)) continue;
      extra.push({ items: [...c.items, bg], base: score([...c.items, bg]).s });
    }
    full = extra.length ? extra : full;
  }
  full = full.filter((c) => hasMust(c.items));

  // final scoring + diversity (greedy: penalise heavy overlap with what is already chosen)
  const ranked = full.sort((a, b) => b.base - a.base).slice(0, 160);
  const chosen: Generated[] = [];
  const used = new Map<string, number>();
  while (chosen.length < limit && ranked.length) {
    let bestI = -1, bestV = -Infinity;
    for (let i = 0; i < ranked.length; i++) {
      const c = ranked[i];
      let overlap = 0;
      for (const it of c.items) overlap += used.get(it.id) ?? 0;
      const sameCore = chosen.some((g) => g.items[0].id === c.items[0].id && g.items[1]?.id === c.items[1]?.id);
      const v = c.base - overlap * 3.2 - (sameCore ? 30 : 0);
      if (v > bestV) { bestV = v; bestI = i; }
    }
    const c = ranked.splice(bestI, 1)[0];
    for (const it of c.items) used.set(it.id, (used.get(it.id) ?? 0) + 1);
    const { f } = score(c.items);
    const note: string[] = [];
    for (const it of c.items) { const r = rotation(it, ctx); if (r.note) note.push(r.note); }
    if (ctx.weather) {
      const hasLayer = c.items.some((i) => i.category === "Outerwear");
      if (hasLayer && layer !== "unknown") note.push(`Layered for ${Math.round(ctx.weather.temp)}°C${ctx.weather.rain ? " and rain" : ""}`);
      else if (!hasLayer && layer === "skip") note.push(`No layer needed at ${Math.round(ctx.weather.temp)}°C`);
    }
    const final = Math.max(35, Math.min(98, Math.round(c.base)));
    chosen.push({ items: c.items, score: final, reasons: f.reasons, note, key: c.items.map((i) => i.id).sort().join("|") });
  }
  return chosen;
}

/* ---------------------------------------------------------------- naming */

const NAME_POOLS: Record<string, string[]> = {
  work: ["Quiet Authority", "Monday Meeting", "Tailored Calm", "Desk to Dinner"],
  formal: ["Dressed Up", "Evening Edit", "Sharp & Easy"],
  date: ["Candlelight", "Dimes Square Date", "First Impressions"],
  casual: ["Chic Brunch", "Easy Sunday", "Slow Coffee", "Weekend Wander"],
  def: ["Everyday Edit", "Smart Layers", "Good Day Look"],
};
export function nameFor(g: { items: GItem[] }, occasionKey: string, index: number): string {
  const pool = NAME_POOLS[occasionKey] ?? NAME_POOLS.def;
  const main = g.items.filter((i) => !["Shoes", "Bags", "Accessories"].includes(i.category) && !traits(i.colorHex).neutral);
  if (main.length && index % 3 === 2) return `${(main[0].colorName || "Colour").split(" ")[0]} Note`;
  return pool[index % pool.length];
}

/* ---------------------------------------------------------------- prompts */

export type Intent = { key: string; label: string; target?: number; weather?: Weather; withBag?: boolean; must: string[]; colourHue?: number; text: string };

const COLOURS: Record<string, number> = { red: 25, rust: 40, orange: 60, yellow: 95, mustard: 90, green: 140, olive: 105, teal: 190, blue: 255, navy: 265, purple: 305, pink: 350, burgundy: 5 };

/** Understands things like "dinner date, a bit dressy", "cold and rainy brunch", "with my olive jacket". */
export function parseIntent(q: string, items: GItem[]): Intent {
  const t = q.toLowerCase();
  let key = "def", label = "today", target: number | undefined;
  if (/work|office|interview|meeting|presentation/.test(t)) { key = "work"; label = "work"; target = 2.6; }
  else if (/wedding|formal|gala|black tie|ceremony/.test(t)) { key = "formal"; label = "a formal event"; target = 3; }
  else if (/date|dinner|romantic|anniversary/.test(t)) { key = "date"; label = "a date"; target = 2.3; }
  else if (/party|night out|club|celebrat|drinks/.test(t)) { key = "date"; label = "a night out"; target = 2.4; }
  else if (/brunch|casual|weekend|coffee|errand|comfy|comfortable|chill|friends|walk|lazy|relax|travel|flight/.test(t)) { key = "casual"; label = "a casual day"; target = 1.4; }
  if (/dressy|dressed up|smart|fancy|elegant/.test(t)) target = Math.min(3, (target ?? 2) + 0.6);
  if (/dress down|laid.?back|relaxed|low.?key|simple/.test(t)) target = Math.max(1, (target ?? 2) - 0.6);

  let weather: Weather | undefined;
  if (/freez|very cold|snow/.test(t)) weather = { temp: 3 };
  else if (/cold|chilly|winter/.test(t)) weather = { temp: 9 };
  else if (/cool|breezy|autumn|fall/.test(t)) weather = { temp: 16 };
  else if (/hot|heat|summer|sweltering/.test(t)) weather = { temp: 32 };
  else if (/warm|sunny/.test(t)) weather = { temp: 25 };
  if (/rain|wet|drizzle|storm/.test(t)) weather = { temp: weather?.temp ?? 15, rain: true };

  // "with my olive jacket" / "wear the white tee": match item names
  const must: string[] = [];
  if (/\b(with|wear|wearing|using|include|around|build)\b/.test(t)) {
    for (const it of items) {
      const nm = `${it.colorName ?? ""} ${it.name}`.toLowerCase();
      const words = it.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const colour = (it.colorName ?? "").toLowerCase();
      const has = (w: string) => new RegExp("\\b" + w + "\\b").test(t);
      const nameHit = words.length >= 1 && words.every(has);
      const colCat = colour && t.includes(colour) && t.includes(it.category.toLowerCase().replace(/s$/, ""));
      if (nameHit || colCat || (nm.trim() && t.includes(nm.trim()))) { must.push(it.id); break; }
    }
  }
  let colourHue: number | undefined;
  for (const [c, h] of Object.entries(COLOURS)) if (new RegExp(`\\b${c}\\b`).test(t) && !must.length) { colourHue = h; break; }
  return { key, label, target, weather, withBag: /bag|tote|carry/.test(t), must, colourHue, text: q.trim() };
}

/* ---------------------------------------------------------------- taste learning */

export type FeedbackRow = { itemIds: string[]; rating: 1 | -1; tags?: string[] };

export function buildTaste(rows: FeedbackRow[], existing: Set<string>): Taste {
  const item: Record<string, number> = {}, pair: Record<string, number> = {};
  const add = (m: Record<string, number>, k: string, d: number, lo: number, hi: number) => (m[k] = Math.max(lo, Math.min(hi, (m[k] ?? 0) + d)));
  for (const r of rows) {
    const ids = r.itemIds.filter((i) => existing.has(i));
    if (ids.length < 1) continue;
    const dislikePair = r.rating < 0 && (r.tags ?? []).some((t) => /pairing/i.test(t));
    for (const id of ids) add(item, id, r.rating > 0 ? 2 : dislikePair ? 0 : -3, -9, 6);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) add(pair, pairKey(ids[a], ids[b]), r.rating > 0 ? 4 : -8, -16, 10);
  }
  return { item, pair };
}

/* ---------------------------------------------------------------- closet review */

export type Verdict = { id: string; verdict: "keep" | "restyle" | "let-go"; why: string };

/** Gentle triage: what to keep, what to try styling differently, what could go. */
export function reviewCloset(items: GItem[], profile: Profile, today: string): Verdict[] {
  return items.map((i) => {
    const fit = itemFit(i, profile).score;
    const age = i.createdAt ? daysBetween(i.createdAt.slice(0, 10), today) : 0;
    if (i.wears >= 3 || fit >= 85) return { id: i.id, verdict: "keep" as const, why: i.wears >= 3 ? `Worn ${i.wears}× — clearly earns its place` : "Strongly suits your colouring and proportions" };
    if (i.wears <= 1 && age > 45 && fit < 70) return { id: i.id, verdict: "let-go" as const, why: "Barely worn and not a strong match for your palette — consider passing it on" };
    if (i.wears <= 1) return { id: i.id, verdict: "restyle" as const, why: "Rarely worn — try it in a new combination before deciding" };
    return { id: i.id, verdict: "keep" as const, why: "Gets some wear and fits you fine" };
  });
}
