import { coloursInText } from "../style/colornames";
import { deltaE, hexToLab } from "../style/color";
import type { Profile } from "../style/profile";
import { outfitFit, type StyleItem } from "../style/score";
import { paletteFit, seasonByKey } from "../style/seasons";
import { assessTrust, median } from "./trust";
import type { Candidate, Piece, Ranked } from "./types";

/* ---------------------------------------------------------------- do I already own this? */

export type OwnedMatch = { id: string; similarity: number; why: string };

const GROUP: Record<string, string> = { Tops: "top", Dresses: "dress", Bottoms: "bottom", Outerwear: "outer", Shoes: "shoes", Bags: "bag", Accessories: "acc" };
const tokens = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);

/** Best owned piece that is close to the one in the inspiration photo (same kind, similar colour/cut). */
export function matchOwned(piece: Piece, owned: (StyleItem & { id: string; name: string })[]): OwnedMatch | null {
  let best: OwnedMatch | null = null;
  const pl = hexToLab(piece.colorHex);
  for (const o of owned) {
    if (GROUP[o.category] !== GROUP[piece.category]) continue;
    const de = deltaE(pl, hexToLab(o.colorHex));
    const colour = Math.max(0, 1 - de / 40);
    const fit = piece.fit && o.fit ? (piece.fit === o.fit ? 1 : 0.4) : 0.6;
    const pat = (piece.pattern || "solid") === (o.pattern || "solid") ? 1 : 0.3;
    const a = new Set(tokens(piece.name)), b = tokens(o.name);
    const nameOverlap = a.size ? b.filter((w) => a.has(w)).length / a.size : 0;
    const sim = Math.round((colour * 0.6 + fit * 0.15 + pat * 0.15 + Math.min(1, nameOverlap) * 0.1) * 100);
    if (de < 24 && sim >= 68 && (!best || sim > best.similarity)) {
      best = { id: o.id, similarity: sim, why: de < 10 ? "Nearly the same colour" : "Similar colour" + (fit === 1 ? " and cut" : "") };
    }
  }
  return best;
}

/* ---------------------------------------------------------------- what would buying it do? */

/** How many good (≥ threshold) outfits would this piece add to what you own? Pair-based, so it stays fast. */
export function unlocks(piece: StyleItem, owned: StyleItem[], profile: Profile, threshold = 78): number {
  const tops = owned.filter((o) => o.category === "Tops"), bottoms = owned.filter((o) => o.category === "Bottoms");
  const ok = (a: StyleItem[]) => outfitFit(a, profile).score >= threshold;
  let n = 0;
  switch (piece.category) {
    case "Tops": for (const b of bottoms) if (ok([piece, b])) n++; break;
    case "Bottoms": for (const t of tops) if (ok([t, piece])) n++; break;
    case "Outerwear": case "Shoes": case "Bags": case "Accessories":
      for (const t of tops) for (const b of bottoms) if (ok([t, b]) && ok([t, b, piece])) n++;
      break;
    case "Dresses": n = ok([piece]) ? 1 + owned.filter((o) => o.category === "Shoes" || o.category === "Outerwear").length : 0; break;
  }
  return n;
}

/* ---------------------------------------------------------------- ranking */

const STOP = new Set(["men", "mens", "women", "womens", "for", "and", "the", "with", "wear", "style", "fit"]);

function relevanceOf(c: Candidate, piece: Piece) {
  const title = ` ${c.title.toLowerCase()} `;
  const want = [...new Set(tokens(piece.query).filter((w) => !STOP.has(w)))];
  if (!want.length) return 0.5;
  const hit = want.filter((w) => title.includes(w)).length;
  return hit / want.length;
}

export function rankProducts(cands: Candidate[], piece: Piece, owned: StyleItem[], profile: Profile, budget?: number | null): Ranked[] {
  const med = median(cands.map((c) => c.price).filter((p): p is number => p != null));
  const season = seasonByKey(profile.color.season);
  const pieceWords = new Set(coloursInText(`${piece.colorName} ${piece.name}`).map((c) => c.word));
  const out: Ranked[] = cands
    .filter((c) => budget == null || c.price == null || c.price <= budget)
    .map((c) => {
      const relevance = relevanceOf(c, piece);
      const found = coloursInText(c.title);
      const dist = (h: string) => deltaE(hexToLab(h), hexToLab(piece.colorHex));
      const tc = [...found].sort((a, b) => dist(a.hex) - dist(b.hex))[0] ?? null; // the title colour closest to what we want
      const colourMatch = found.some((f) => pieceWords.has(f.word) || dist(f.hex) < 18);
      const hex = tc?.hex ?? piece.colorHex;
      const pf = paletteFit(hex, season);
      const style: StyleItem = { category: piece.category, colorHex: hex, colorName: tc?.word ?? piece.colorName, fit: piece.fit, formality: piece.formality, pattern: piece.pattern };
      const budgetish = c.price != null && med != null && c.price <= med * 0.7 && (c.rating == null || c.rating >= 4);
      const trust = assessTrust(c, med);
      const tier: Ranked["tier"] = trust.level === "caution" ? "similar" : relevance >= 0.7 && colourMatch ? "best" : budgetish ? "budget" : "similar";
      return { ...c, trust, relevance, tier, colourMatch, palette: { delta: pf.delta, text: pf.text }, unlocks: unlocks(style, owned, profile) } as Ranked;
    });
  const score = (r: Ranked) => r.relevance * 50 + (r.colourMatch ? 15 : 0) + (r.rating ?? 3.8) * 4 + Math.log10((r.reviews ?? 0) + 1) * 3 + r.palette.delta * 0.5 + Math.min(r.unlocks, 8) - (r.trust.level === "caution" ? 25 : r.trust.level === "unknown" ? 5 : 0);
  // anything flagged "be careful" sinks below every other result, however well it matches
  return out.sort((a, b) => (a.trust.level === "caution" ? 1 : 0) - (b.trust.level === "caution" ? 1 : 0) || score(b) - score(a));
}
