import type { FaceShape } from "../style/face";
import type { Profile } from "../style/profile";
import { seasonByKey } from "../style/seasons";
import { BEARDS, FRAMES, HAIRSTYLES, type BeardStyle, type FrameStyle, type HairStyle } from "./catalog";

const clamp = (v: number, lo = 35, hi = 98) => Math.max(lo, Math.min(hi, Math.round(v)));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Result<T> = { item: T; score: number; reasons: string[]; cautions: string[] };

/** What flatters each face shape, in plain words — used when a style's score for that shape is clearly positive or negative. */
const GUIDE: Record<FaceShape, { good: string; bad: string }> = {
  oval: { good: "Your balanced proportions carry this well", bad: "It works, but doesn't use your shape's flexibility" },
  round: { good: "Height and length lengthen a round face", bad: "Extra width at the cheeks or jaw can emphasise roundness" },
  square: { good: "Softness and texture balance a strong jawline", bad: "More hard angles can make a strong jaw feel severe" },
  oblong: { good: "Width at the sides and a fringe balance a longer face", bad: "More height or length can stretch a longer face" },
  heart: { good: "Fullness lower down balances a wider forehead", bad: "More weight at the top emphasises a wider forehead" },
  diamond: { good: "It frames the cheekbones and balances a narrower forehead and jaw", bad: "It adds width at the cheekbones, where you already have it" },
};

function faceTerms<T extends { faces: Partial<Record<FaceShape, number>> }>(it: T, face: FaceShape | null, reasons: string[], cautions: string[]): number {
  if (!face) return 0;
  const f = it.faces[face] ?? 0;
  if (f >= 2) reasons.push(`${GUIDE[face].good} (${face} face)`);
  else if (f === 1) reasons.push(`A good match for a ${face} face`);
  else if (f <= -1) cautions.push(`${GUIDE[face].bad}`);
  return f * 10;
}

/* ------------------------------------------------------------------ hair */

/** A reason that names what this particular cut does for this face, rather than a generic line. */
function hairReason(h: HairStyle, face: FaceShape): string | null {
  const il = h.illus, longish = il.length === "shoulder" || il.length === "long", chin = il.length === "chin";
  switch (face) {
    case "round":
      if (il.extra === "bun") return "Worn high, it adds the height that lengthens a round face";
      if (il.top >= 0.3) return "The height on top lengthens a round face";
      if (longish) return "Length below the chin elongates a round face";
      if (il.fringe === "side" || il.part === "side") return "A side sweep adds angle to a round face";
      return null;
    case "square":
      if (il.length === "buzz") return "A clean, close cut shows off a strong jawline";
      if (il.wave >= 0.3 || il.fringe !== "none") return "Texture and a softer fringe balance a strong jaw";
      return null;
    case "oblong":
      if (il.fringe === "full" || il.fringe === "curtain") return "A fringe shortens a longer face";
      if ((chin || longish) && il.sides === "full" && il.top < 0.3) return "Fullness at the sides adds width to a longer face";
      return null;
    case "heart":
      if (il.fringe !== "none") return "A fringe softens a wider forehead";
      if (chin || il.length === "shoulder") return "Fullness at the chin line balances a narrower jaw";
      return null;
    case "diamond":
      if (il.fringe === "curtain" || il.fringe === "side") return "A fringe balances a narrower forehead";
      if (chin) return "Length at the jaw balances a narrower chin";
      return null;
    case "oval": return il.top > 0.45 ? "Your balanced face can carry this much volume" : "Keeps your balanced proportions even";
  }
}

export function suggestHair(p: Profile): Result<HairStyle>[] & { needs?: string[] } {
  const g = p.grooming, face = p.face.shape;
  const out = HAIRSTYLES.map((h) => {
    const reasons: string[] = [], cautions: string[] = [];
    let s = 60;
    s += faceTerms(h, face, reasons, cautions);
    if (face && (h.faces[face] ?? 0) >= 1) { const specific = hairReason(h, face); if (specific) reasons[0] = specific; }
    if (g.maintenance == null) s -= h.maintenance * 0.8; // with no preference, easier styles edge ahead
    if (g.hairType) {
      if (h.textures.includes(g.hairType)) { s += 8; reasons.push(`Works with ${g.hairType} hair`); }
      else { s -= 24; cautions.push(`Made for ${h.textures.join(" / ")} hair — on ${g.hairType} hair it would need heat or chemical straightening`); }
    }
    if (g.density === "thin") {
      if (h.thinOK) { s += 4; reasons.push("Looks good with finer hair"); } else { s -= 12; cautions.push("Needs fuller hair to hold its shape"); }
    }
    if (g.receding) {
      if (h.recedingOK) s += 3; else { s -= 14; cautions.push("Works best with a full hairline"); }
    }
    if (g.maintenance === 1) {
      if (h.maintenance === 3) { s -= 12; cautions.push("Needs daily styling and frequent cuts"); } else if (h.maintenance === 1) { s += 6; reasons.push("Low effort day to day"); }
    } else if (g.maintenance === 2 && h.maintenance === 3) { s -= 4; cautions.push("Takes a few minutes of styling each morning"); }
    if (g.length === "short" && h.growMonths) cautions.push(`About ${h.growMonths} months to grow from where you are`);
    return { item: h, score: clamp(s), reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 2) };
  });
  const sorted = out.sort((a, b) => b.score - a.score) as Result<HairStyle>[] & { needs?: string[] };
  sorted.needs = [!face ? "face shape" : "", !g.hairType ? "hair type" : ""].filter(Boolean);
  return sorted;
}

/* ------------------------------------------------------------------ facial hair */

export function suggestBeards(p: Profile): Result<BeardStyle>[] & { needs?: string[] } {
  const g = p.grooming, face = p.face.shape;
  const out = BEARDS.map((b) => {
    const reasons: string[] = [], cautions: string[] = [];
    let s = 60;
    s += faceTerms(b, face, reasons, cautions);
    if (g.beardGrowth === "patchy") {
      if (b.patchyOK) { s += 8; reasons.push("Works well with patchy or thinner growth"); } else { s -= 18; cautions.push("Needs even, full growth to look intentional"); }
    } else if (g.beardGrowth === "full" && !b.patchyOK) { s += 4; reasons.push("Makes the most of full growth"); }
    if (g.maintenance === 1 && b.maintenance === 3) { s -= 10; cautions.push(`Needs trimming about every ${b.trimDays} days`); }
    if (g.maintenance === 1 && b.maintenance === 1) { s += 4; reasons.push("Low upkeep"); }
    return { item: b, score: clamp(s), reasons: reasons.slice(0, 3), cautions: cautions.slice(0, 2) };
  });
  const sorted = out.sort((a, b) => b.score - a.score) as Result<BeardStyle>[] & { needs?: string[] };
  sorted.needs = [!face ? "face shape" : "", !g.beardGrowth ? "beard growth" : ""].filter(Boolean);
  return sorted;
}

/* ------------------------------------------------------------------ glasses */

export type FrameColour = { name: string; hex: string };

/** Frame colours that sit well with a colour season: warm woods and golds, or cool blacks, navies and silvers. */
export function frameColours(seasonKey: string | null): { colours: FrameColour[]; note: string } {
  const s = seasonByKey(seasonKey);
  if (!s) return { colours: [{ name: "Black", hex: "#1b1b1d" }, { name: "Tortoiseshell", hex: "#8a5a2b" }, { name: "Navy", hex: "#26324d" }, { name: "Silver", hex: "#c0c4c9" }, { name: "Gold", hex: "#c9a24a" }], note: "Set up colour analysis to narrow these to your palette." };
  const { warmth, depth, clarity } = s.axes;
  if (warmth > 0.2) {
    if (clarity < 0) return { colours: [{ name: "Tortoiseshell", hex: "#8a5a2b" }, { name: "Warm brown", hex: "#5a3a28" }, { name: "Olive", hex: "#6b6b3a" }, { name: "Antique gold", hex: "#c9a24a" }, { name: "Terracotta", hex: "#b0623a" }], note: `Warm, softened tones suit your ${s.name} colouring.` };
    return { colours: [{ name: "Honey tortoise", hex: "#b98a58" }, { name: "Chocolate", hex: "#3b2418" }, { name: "Teal", hex: "#2a6a6a" }, { name: "Gold", hex: "#c9a24a" }, { name: "Coral", hex: "#e2705a" }], note: `Warm, clearer tones suit your ${s.name} colouring.` };
  }
  if (warmth < -0.2) {
    if (depth > 0) return { colours: [{ name: "Black", hex: "#1b1b1d" }, { name: "Navy", hex: "#26324d" }, { name: "Burgundy", hex: "#6a1b3a" }, { name: "Gunmetal", hex: "#5a6270" }, { name: "Silver", hex: "#c0c4c9" }], note: `Deep, cool tones suit your ${s.name} colouring.` };
    return { colours: [{ name: "Soft grey", hex: "#8a8d91" }, { name: "Slate blue", hex: "#6f7b95" }, { name: "Rose", hex: "#c49aa0" }, { name: "Silver", hex: "#c0c4c9" }, { name: "Clear crystal", hex: "#d9dde3" }], note: `Lighter, cool tones suit your ${s.name} colouring.` };
  }
  return { colours: [{ name: "Soft black", hex: "#2b2b2d" }, { name: "Taupe", hex: "#9a8a7b" }, { name: "Muted tortoise", hex: "#7a5a3a" }, { name: "Rose gold", hex: "#c9988a" }, { name: "Gunmetal", hex: "#5a6270" }], note: "Neutral, muted tones are the safest match for your colouring." };
}

export function suggestFrames(p: Profile): Result<FrameStyle>[] & { needs?: string[] } {
  const face = p.face.shape;
  const season = seasonByKey(p.color.season);
  const strong = season ? season.axes.clarity > 0.3 || season.axes.depth > 0.6 : false;
  const gentle = season ? season.axes.clarity < -0.3 : false;
  const out = FRAMES.map((f) => {
    const reasons: string[] = [], cautions: string[] = [];
    let s = 60;
    if (face) {
      const v = f.faces[face] ?? 0;
      s += v * 11;
      const why = f.why[face];
      if (why) (v >= 1 ? reasons : v <= -1 ? cautions : reasons).push(why);
      else if (v >= 2) reasons.push(`Flatters a ${face} face`);
    }
    if (strong && f.bold === 3) { s += 4; reasons.push("A bolder frame matches your high-contrast colouring"); }
    if (strong && f.bold === 1) { s -= 3; }
    if (gentle && f.bold === 1) { s += 4; reasons.push("A lighter frame matches your soft, blended colouring"); }
    if (gentle && f.bold === 3) { s -= 4; cautions.push("A heavy frame can overpower softer colouring"); }
    return { item: f, score: clamp(s), reasons: reasons.slice(0, 2), cautions: cautions.slice(0, 2) };
  });
  const sorted = out.sort((a, b) => b.score - a.score) as Result<FrameStyle>[] & { needs?: string[] };
  sorted.needs = !face ? ["face shape"] : [];
  return sorted;
}

/* ------------------------------------------------------------------ "show this to your barber" */

export function barberText(p: Profile, kind: "hair" | "beard", id: string): string {
  const g = p.grooming, face = p.face.shape;
  const lines: string[] = [];
  if (kind === "hair") {
    const h = HAIRSTYLES.find((x) => x.id === id);
    if (!h) return "";
    lines.push(`${h.name}`, "", "Ask for:", h.ask);
    const me = [g.hairType && `${g.hairType} hair`, g.density && `${g.density} density`, g.receding ? "receding hairline" : null, face && `${face} face shape`].filter(Boolean);
    if (me.length) lines.push("", `About me: ${me.join(", ")}.`);
    lines.push("", `Keeping it fresh: a trim about every ${h.trimWeeks} weeks.`);
    if (h.tips.length) lines.push("", "Styling:", ...h.tips.map((t) => `• ${t}`));
    if (h.avoid) lines.push("", `Worth knowing: ${h.avoid}`);
  } else {
    const b = BEARDS.find((x) => x.id === id);
    if (!b) return "";
    lines.push(`${b.name}`, "", "Ask for:", b.ask);
    const me = [g.beardGrowth && `${g.beardGrowth} growth`, face && `${face} face shape`].filter(Boolean);
    if (me.length) lines.push("", `About me: ${me.join(", ")}.`);
    lines.push("", `Keeping it fresh: tidy about every ${b.trimDays} days.`);
    if (b.tips.length) lines.push("", "Tips:", ...b.tips.map((t) => `• ${t}`));
    if (b.avoid) lines.push("", `Worth knowing: ${b.avoid}`);
  }
  return lines.join("\n");
}

export const labelOf = (s: string) => cap(s);
