// A 2D, front-facing avatar built from your profile. Pure geometry: no DOM, no network.
// It is a *preview* — a paper-doll to judge silhouette, proportion and colour — never a medical or body-shape judgement.
import type { Profile } from "../style/profile";

export const CANVAS = { w: 400, h: 900 };
const TOP = 40;
const H = 820; // figure height in px (head top → soles)

export type Geo = {
  cx: number;
  top: number; H: number;
  headR: number; headCY: number; chinY: number;
  neckHalf: number;
  shoulderY: number; shoulderHalf: number;
  chestY: number; waistY: number; waistHalf: number;
  hipY: number; hipHalf: number;
  crotchY: number; kneeY: number; ankleY: number; footY: number;
  armHalf: number; wristY: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A starting point for the build slider from height and weight (BMI). Always adjustable; null weight → 0 (average). */
export function defaultBuild(height: number | null, weight: number | null): number {
  if (!height || !weight || height < 100 || weight < 25) return 0;
  const bmi = weight / (height / 100) ** 2;
  return Math.round(clamp((bmi - 22) / 7, -0.7, 1) * 100) / 100;
}

export function geometry(p: Profile): Geo {
  const height = p.basics.height && p.basics.height > 100 ? p.basics.height : 175;
  const s = H / height; // px per cm
  const a = p.avatar;
  const b = p.body;
  const m = p.measurements;

  const build = a.build ?? defaultBuild(p.basics.height, p.basics.weight);
  const bf = 1 + 0.14 * build;

  const shCm = b.shoulderHip === "broader-shoulders" ? 24 : b.shoulderHip === "broader-hips" ? 20.5 : b.shoulderHip === "balanced" ? 21.5 : 22;
  const hipCm = b.shoulderHip === "broader-shoulders" ? 17 : b.shoulderHip === "broader-hips" ? 21 : 18.5;
  const waistCm = b.waist === "defined" ? 14 : b.waist === "straight" ? 16.5 : 15.5;

  // measured circumferences beat descriptors (and already include the person's build)
  const sh = (m.chest ? m.chest * 0.215 : shCm * bf) * (1 + a.shoulders * 0.1);
  const hip = (m.hip ? m.hip * 0.19 : hipCm * bf) * (1 + a.hips * 0.1);
  const wa = (m.waist ? m.waist * 0.17 : waistCm * bf) * (1 + a.waist * 0.1);

  const shift = (b.torsoLeg === "longer-torso" ? 0.012 : b.torsoLeg === "longer-legs" ? -0.012 : 0) - a.legs * 0.012;
  const y = (f: number) => TOP + f * H;

  const shoulderHalf = sh * s;
  const hipHalf = hip * s;
  const waistHalf = Math.max(8, Math.min(wa * s, Math.max(shoulderHalf, hipHalf) * 1.02));
  const headR = 0.063 * H;
  const chinY = y(0.125);
  return {
    cx: CANVAS.w / 2, top: TOP, H,
    headR, headCY: chinY - headR * 0.92, chinY,
    neckHalf: headR * 0.3,
    shoulderY: y(0.185), shoulderHalf,
    chestY: y(0.25), waistY: y(0.375 + shift), waistHalf,
    hipY: y(0.465 + shift), hipHalf,
    crotchY: y(0.515 + shift), kneeY: y(0.72), ankleY: y(0.945), footY: y(1),
    armHalf: Math.max(7, 0.019 * H * (0.9 + 0.1 * bf)), wristY: y(0.505 + shift),
  };
}

/* ------------------------------------------------------------------ putting clothes on */

export type Rect = { x: number; y: number; w: number; h: number };
type PlaceOpts = { length?: string; fit?: string };

/** Where a garment photo goes on the figure. `aspect` = image width ÷ height. */
export function placeItem(category: string, aspect: number, g: Geo, o: PlaceOpts = {}): Rect | null {
  const asp = clamp(aspect || 1, 0.2, 5);
  const fitW = o.fit === "oversized" ? 1.12 : o.fit === "fitted" || o.fit === "slim" ? 0.96 : 1;
  const long = o.length === "long", cropped = o.length === "cropped";
  const maxW = CANVAS.w - 8;
  const centre = (w: number, y: number, h: number): Rect => {
    if (w > maxW) { h *= maxW / w; w = maxW; } // never wider than the canvas
    return { x: g.cx - w / 2, y, w, h };
  };
  switch (category) {
    case "Tops": {
      const topY = g.shoulderY - 16;
      const maxH = (cropped ? g.waistY - topY + 6 : long ? g.kneeY - topY - 40 : g.hipY - topY + 34);
      let w = g.shoulderHalf * 2 * 1.5 * fitW, h = w / asp;
      if (h > maxH) { h = maxH; w = h * asp; }
      return centre(w, topY, h);
    }
    case "Outerwear": {
      const topY = g.shoulderY - 18;
      const maxH = cropped ? g.waistY - topY + 22 : long ? g.kneeY - topY + 36 : g.hipY - topY + 62;
      let w = g.shoulderHalf * 2 * 1.68 * fitW, h = w / asp;
      if (h > maxH) { h = maxH; w = h * asp; }
      return centre(w, topY, h);
    }
    case "Bottoms": {
      const topY = g.waistY - 10;
      const h = (g.ankleY + 14 - topY) * (cropped ? 0.84 : 0.99);
      let w = h * asp;
      const maxW = g.hipHalf * 2 * 2.1;
      if (w > maxW) { w = maxW; }
      return centre(w, topY, h);
    }
    case "Dresses": {
      const topY = g.shoulderY - 16;
      const h = (long ? g.ankleY - 30 : cropped ? g.kneeY - 90 : g.kneeY + 18) - topY;
      const w = Math.min(h * asp, g.shoulderHalf * 2 * 1.9);
      return centre(w, topY, h);
    }
    case "Shoes": {
      const w = g.hipHalf * 2 * 1.2;
      const h = w / asp;
      return centre(w, g.footY - h + 10, h);
    }
    case "Bags": {
      const w = 76, h = Math.min(120, w / asp);
      return { x: Math.min(g.cx + g.hipHalf + 18, CANVAS.w - w - 4), y: g.hipY + 6, w, h };
    }
    default: return null; // accessories aren't drawn
  }
}

const Z: Record<string, number> = { Bottoms: 1, Shoes: 2, Tops: 3, Dresses: 3, Outerwear: 4, Bags: 5 };

/** Which pieces to draw and in what order. A dress replaces tops and bottoms. */
export function layers<T extends { category: string }>(items: T[]): T[] {
  const hasDress = items.some((i) => i.category === "Dresses");
  return items
    .filter((i) => i.category in Z && !(hasDress && (i.category === "Tops" || i.category === "Bottoms")))
    .sort((a, b) => Z[a.category] - Z[b.category]);
}

/** Fallback aspect ratios until the real photo size is known. */
export const DEFAULT_ASPECT: Record<string, number> = { Tops: 1.15, Outerwear: 1.0, Bottoms: 0.55, Dresses: 0.62, Shoes: 1.6, Bags: 1.2 };

export const SKIN_TONES = ["#f6d9c4", "#efc7a5", "#e0ac86", "#c98e66", "#a8714d", "#80533a", "#5c3b2a", "#3f281d"];
export const HAIR_COLOURS = ["#1c1714", "#3b2a20", "#5a3a28", "#7a5230", "#a9744a", "#c9a24a", "#d8c9a3", "#8a8d91", "#e6e2dc", "#8c2f1d"];
