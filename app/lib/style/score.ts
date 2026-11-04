// "Suits you" scoring: transparent rules → score + human-readable reasons.
import { hueGap, traits } from "./color";
import type { Profile } from "./profile";
import { paletteFit, seasonByKey } from "./seasons";

export type StyleItem = {
  id?: string;
  category: string;
  colorHex: string;
  colorName?: string;
  fit?: string;
  formality?: number;
  pattern?: string;
  attrs?: Record<string, unknown>;
  name?: string;
};

export type Reason = { text: string; delta: number; kind: "colour" | "proportion" | "face" | "formality" | "pattern" | "harmony" | "goal" };
export type Fit = { score: number; label: string; reasons: Reason[]; needs: string[] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const label = (s: number) => (s >= 85 ? "Great fit" : s >= 75 ? "Good fit" : s >= 65 ? "Works" : "Wear selectively");

const str = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : "");
const neck = (i: StyleItem) => str(i.attrs?.neckline);
const rise = (i: StyleItem) => str(i.attrs?.rise);
const length = (i: StyleItem) => str(i.attrs?.length);

/** Colours near the face matter most. */
const FACE_WEIGHT: Record<string, number> = { Tops: 1, Dresses: 1, Outerwear: 0.9, Accessories: 0.6, Bottoms: 0.45, Bags: 0.35, Shoes: 0.3 };

function top(reasons: Reason[], n = 3): Reason[] {
  const sorted = [...reasons].filter((r) => r.delta !== 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const picked = sorted.slice(0, n);
  // always surface the biggest caution so the score is never rosier than the reasons
  const worst = sorted.filter((r) => r.delta <= -6)[0];
  if (worst && !picked.includes(worst)) picked[picked.length - 1] = worst;
  return picked;
}

/** How well one piece suits this person (colour, proportions, face). */
export function itemFit(it: StyleItem, p: Profile): Fit {
  const reasons: Reason[] = [];
  const needs: string[] = [];
  const season = seasonByKey(p.color.season);
  const w = FACE_WEIGHT[it.category] ?? 0.5;

  // ---- colour
  if (season) {
    const f = paletteFit(it.colorHex, season);
    if (f.text && f.delta) {
      // the "keep it away from your face" wording only makes sense for pieces worn near the face
      const text = f.zone === "avoid" && w < 0.6 ? `This shade is on your "use sparingly" list for ${season.name}, but worn lower down it matters much less` : f.text;
      reasons.push({ text, delta: Math.round(f.delta * w), kind: "colour" });
    }
    // stark white / pure black near the face are harsh on soft or warm colouring
    const t = traits(it.colorHex);
    if (w >= 0.9 && t.L > 93 && (season.axes.clarity < -0.3 || season.axes.warmth > 0.3))
      reasons.push({ text: "Stark white can feel harsh against your colouring — cream or ivory is softer", delta: -4, kind: "colour" });
    if (w >= 0.9 && t.L < 14 && season.axes.clarity < -0.3)
      reasons.push({ text: "Pure black next to the face can be heavy for softer colouring — charcoal or deep brown is gentler", delta: -4, kind: "colour" });
  } else needs.push("colour");

  // ---- proportions
  const b = p.body;
  const fit = str(it.fit);
  const hasBody = !!(b.shoulderHip || b.torsoLeg || b.waist);
  if (!hasBody) needs.push("proportions");
  if (b.shoulderHip === "broader-shoulders") {
    if (it.category === "Bottoms" && ["wide", "straight", "relaxed"].includes(fit))
      reasons.push({ text: `${cap(fit)} legs add volume below, balancing your broader shoulders`, delta: 7, kind: "proportion" });
    if (it.category === "Tops" && (neck(it).includes("boat") || neck(it).includes("off")))
      reasons.push({ text: "A wide neckline adds width across the shoulders you already have", delta: -5, kind: "proportion" });
    if (it.category === "Tops" && neck(it).includes("v"))
      reasons.push({ text: "A V-neckline draws the eye down the centre and softens broad shoulders", delta: 5, kind: "proportion" });
  }
  if (b.shoulderHip === "broader-hips") {
    if (it.category === "Tops" && ["fitted", "regular"].includes(fit))
      reasons.push({ text: "A clean-fitted top keeps attention at the shoulder line", delta: 5, kind: "proportion" });
    if (it.category === "Bottoms" && traits(it.colorHex).L < 40)
      reasons.push({ text: "A darker bottom streamlines the hip line", delta: 5, kind: "proportion" });
    if (it.category === "Outerwear" && length(it) === "cropped")
      reasons.push({ text: "A hip-length cropped layer ends right at your widest point — a longer line may be kinder", delta: -4, kind: "proportion" });
  }
  if (b.torsoLeg === "longer-torso") {
    if (it.category === "Bottoms" && rise(it) === "high")
      reasons.push({ text: "High-rise shortens a longer torso and lengthens the leg line", delta: 7, kind: "proportion" });
    if (it.category === "Tops" && length(it) === "cropped")
      reasons.push({ text: "A shorter top balances a longer torso", delta: 5, kind: "proportion" });
  }
  if (b.torsoLeg === "longer-legs") {
    if (it.category === "Tops" && (length(it) === "long" || fit === "oversized"))
      reasons.push({ text: "A longer top balances your longer legs", delta: 5, kind: "proportion" });
    if (it.category === "Bottoms" && rise(it) === "low")
      reasons.push({ text: "Low-rise suits longer legs and keeps the torso from looking short", delta: 4, kind: "proportion" });
  }
  if (b.waist === "defined" && ["fitted"].includes(fit))
    reasons.push({ text: "A fitted cut shows your defined waist", delta: 5, kind: "proportion" });
  if (b.waist === "straight" && (["relaxed", "oversized"].includes(fit) || str(it.attrs?.closure).includes("structured")))
    reasons.push({ text: "A relaxed or structured cut creates shape without needing a defined waist", delta: 4, kind: "proportion" });

  // ---- goals
  for (const aim of p.basics.aims) {
    if (aim === "Look taller / lengthen legs") {
      if (it.category === "Bottoms" && rise(it) === "high") reasons.push({ text: "High-rise supports your goal of lengthening the legs", delta: 5, kind: "goal" });
      if (it.category === "Outerwear" && length(it) === "cropped") reasons.push({ text: "A cropped layer keeps the leg line long — matches your goal", delta: 4, kind: "goal" });
    }
    if (aim === "Define my waist" && fit === "fitted") reasons.push({ text: "Fitted cut supports your goal to define the waist", delta: 4, kind: "goal" });
    if (aim === "Add structure" && it.category === "Outerwear") reasons.push({ text: "Structured layers support your goal to add structure", delta: 3, kind: "goal" });
    if (aim === "Keep it relaxed and easy" && ["relaxed", "oversized", "wide"].includes(fit)) reasons.push({ text: "Easy, relaxed shape — matches how you like to dress", delta: 3, kind: "goal" });
  }

  // ---- fit preference
  if (p.basics.fit === "Tailored" && ["fitted", "slim", "straight"].includes(fit)) reasons.push({ text: "Tailored cut matches your preference", delta: 3, kind: "goal" });
  if (p.basics.fit === "Relaxed" && ["relaxed", "oversized", "wide", "regular"].includes(fit)) reasons.push({ text: "Relaxed cut matches your preference", delta: 3, kind: "goal" });
  if (p.basics.fit === "Tailored" && fit === "oversized") reasons.push({ text: "Oversized is outside your tailored preference", delta: -4, kind: "goal" });

  // ---- face shape × neckline
  const fs = p.face.shape;
  if (!fs) needs.push("face shape");
  else if (it.category === "Tops" || it.category === "Dresses") {
    const n = neck(it);
    if (!n) needs.push("neckline");
    else {
      const v = n.includes("v") && !n.includes("crew"), crew = n.includes("crew") || n.includes("round"), scoop = n.includes("scoop"),
        boat = n.includes("boat") || n.includes("off"), turtle = n.includes("turtle") || n.includes("mock") || n.includes("high"), collar = n.includes("collar") || n.includes("polo");
      const add = (text: string, delta: number) => reasons.push({ text, delta, kind: "face" });
      if (fs === "round") { if (v || scoop || collar) add("An open neckline lengthens a round face", 5); if (turtle) add("A high neck can emphasise roundness", -4); }
      if (fs === "square") { if (scoop || crew) add("A rounded neckline softens a strong jaw", 5); if (v && n.includes("deep")) add("A sharp deep V echoes the angles of your jaw", -3); }
      if (fs === "oblong") { if (crew || boat || turtle) add("A closer or wider neckline adds width to a longer face", 5); if (v) add("A deep V adds more length to an already long face", -4); }
      if (fs === "heart") { if (scoop || crew || boat) add("A rounded neckline balances a wider forehead", 4); }
      if (fs === "diamond") { if (scoop || boat) add("A wider neckline balances narrower forehead and jaw", 4); }
      if (fs === "oval") add("Oval faces carry nearly any neckline", 1);
    }
  }

  const sum = reasons.reduce((a, r) => a + r.delta, 0);
  const score = clamp(Math.round(72 + sum), 35, 98);
  return { score, label: label(score), reasons: top(reasons), needs: [...new Set(needs)] };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATEMENT = new Set(["floral", "graphic", "checked", "striped", "other"]);

/** How well a set of pieces works together on this person. */
export function outfitFit(items: StyleItem[], p: Profile, target?: number): Fit {
  const reasons: Reason[] = [];
  const needs: string[] = [];
  if (!items.length) return { score: 0, label: "", reasons: [], needs: [] };

  // per-item personal fit, averaged and weighted by closeness to the face
  const fits = items.map((i) => ({ i, f: itemFit(i, p) }));
  for (const { f } of fits) needs.push(...f.needs);
  let wsum = 0, dsum = 0;
  for (const { i, f } of fits) {
    const w = FACE_WEIGHT[i.category] ?? 0.5;
    wsum += w;
    dsum += (f.score - 72) * w;
  }
  const personal = wsum ? dsum / wsum : 0;
  for (const { i, f } of fits) for (const r of f.reasons) reasons.push({ ...r, delta: Math.round(r.delta * 0.6), text: items.length > 1 ? `${i.name ? i.name + ": " : ""}${lowerFirst(r.text)}` : r.text });

  let sum = personal * 0.8;

  // ---- colour harmony
  const clothes = items.filter((i) => !["Shoes", "Bags", "Accessories"].includes(i.category));
  const ts = clothes.map((i) => ({ i, t: traits(i.colorHex) }));
  const chroma = ts.filter((x) => !x.t.neutral);
  const hues: number[] = [];
  for (const c of chroma) if (!hues.some((h) => hueGap(h, c.t.h) < 25)) hues.push(c.t.h);
  if (chroma.length === 0) reasons.push({ text: "A calm neutral palette — nothing competes, so it reads polished", delta: 8, kind: "harmony" });
  else if (hues.length === 1) reasons.push({ text: `One colour family (${(chroma[0].i.colorName || "accent").toLowerCase()}) against neutrals keeps it intentional`, delta: 12, kind: "harmony" });
  else if (hues.length === 2) {
    const g = hueGap(hues[0], hues[1]);
    const muted = chroma.every((c) => c.t.C < 56); // earthy, softened colours sit together more easily
    if (g < 50) reasons.push({ text: "Neighbouring colours on the wheel blend smoothly", delta: 9, kind: "harmony" });
    else if (g >= 150) reasons.push({ text: "Complementary colours give a confident contrast", delta: 8, kind: "harmony" });
    else if (muted) reasons.push({ text: "Muted, earthy tones sit together comfortably", delta: 5, kind: "harmony" });
    else reasons.push({ text: "These two colours compete — try swapping one for a neutral", delta: -14, kind: "harmony" });
  } else reasons.push({ text: "Three or more colour families is a lot — anchor with neutrals", delta: -12, kind: "harmony" });
  // sum the harmony delta (the last pushed)
  sum += reasons[reasons.length - 1].delta;

  // ---- patterns
  const loud = clothes.filter((i) => STATEMENT.has(str(i.pattern)));
  if (loud.length >= 2) { reasons.push({ text: "Two statement patterns fight for attention — keep one", delta: -10, kind: "pattern" }); sum -= 10; }
  else if (loud.length === 1) { reasons.push({ text: "One statement pattern with solids is easy to wear", delta: 4, kind: "pattern" }); sum += 4; }

  // ---- silhouette & formality
  const topI = items.find((i) => i.category === "Tops"), botI = items.find((i) => i.category === "Bottoms");
  if (topI && botI) {
    const tf = str(topI.fit), bf = str(botI.fit);
    if (["oversized", "relaxed"].includes(tf) && ["wide", "relaxed"].includes(bf)) { reasons.push({ text: "Volume on top and bottom can swamp the frame — keep one side fitted", delta: -9, kind: "proportion" }); sum -= 9; }
    else if (["fitted", "slim"].includes(tf) && ["wide", "relaxed"].includes(bf)) { reasons.push({ text: "A fitted top against a wide leg gives a clear, balanced silhouette", delta: 8, kind: "proportion" }); sum += 8; }
    else if (["oversized", "relaxed"].includes(tf) && ["slim", "straight", "fitted"].includes(bf)) { reasons.push({ text: "A relaxed top over a slimmer leg keeps the proportions tidy", delta: 7, kind: "proportion" }); sum += 7; }
    if (Math.abs((topI.formality ?? 1) - (botI.formality ?? 1)) >= 2) { reasons.push({ text: "Formality gap: one piece is much dressier than the other", delta: -8, kind: "formality" }); sum -= 8; }
  }
  const shoe = items.find((i) => i.category === "Shoes");
  if (shoe && clothes.length) {
    const avg = clothes.reduce((a, i) => a + (i.formality ?? 1), 0) / clothes.length;
    if (Math.abs((shoe.formality ?? 1) - avg) > 1.5) { reasons.push({ text: "Shoes and clothes sit at different levels of dressiness", delta: -5, kind: "formality" }); sum -= 5; }
  }
  if (target != null && clothes.length) {
    const avg = clothes.reduce((a, i) => a + (i.formality ?? 1), 0) / clothes.length;
    const gap = Math.abs(avg - target);
    if (gap < 0.5) { reasons.push({ text: "Right level of dressiness for the occasion", delta: 4, kind: "formality" }); sum += 4; }
    else { reasons.push({ text: gap > 1 ? "Noticeably off for the occasion's dressiness" : "A touch off for the occasion's dressiness", delta: -Math.round(gap * 6), kind: "formality" }); sum -= gap * 6; }
  }

  // ---- goals at outfit level
  if (p.basics.aims.includes("Look taller / lengthen legs") && clothes.length >= 2) {
    const lows = clothes.filter((i) => ["Tops", "Bottoms"].includes(i.category)).map((i) => traits(i.colorHex));
    if (lows.length === 2 && hueGap(lows[0].h, lows[1].h) < 30 && Math.abs(lows[0].L - lows[1].L) < 22) { reasons.push({ text: "A near-monochrome column lengthens the line — matches your goal", delta: 5, kind: "goal" }); sum += 5; }
  }

  const score = clamp(Math.round(62 + sum), 35, 98);
  return { score, label: label(score), reasons: top(reasons, 4), needs: [...new Set(needs)] };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
