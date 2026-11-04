// Turns colour samples (from photos) and quiz answers into season axes. Pure maths.
import { medianRgb, rgbToLab, type RGB } from "./color";
import { classifySeason, type Axes, type SeasonGuess } from "./seasons";

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

export type PhotoSamples = {
  skin: RGB[];        // cheeks + forehead patches
  hair?: RGB[] | null;
  eyes?: RGB[] | null;
  /** chroma of the whole-image average colour: a strong cast means unreliable lighting */
  castChroma?: number;
  /** mean skin luminance 0..255, to catch under/over-exposure */
  exposure?: number;
};

export type PhotoReading = Axes & { evidence: number; notes: string[] };

/** One photo → axes. `evidence` (0..1) says how much to trust it. */
export function readPhoto(s: PhotoSamples): PhotoReading {
  const notes: string[] = [];
  const skin = rgbToLab(medianRgb(s.skin));
  const hair = s.hair?.length ? rgbToLab(medianRgb(s.hair)) : null;
  const eyes = s.eyes?.length ? rgbToLab(medianRgb(s.eyes)) : null;

  // warmth: skin hue angle. ~50° reads pink/cool, ~65° reads golden/warm
  const hue = (Math.atan2(skin[2], skin[1]) * 180) / Math.PI;
  const warmth = clamp((hue - 56) / 9);

  // depth: weighted overall lightness of skin, hair, eyes
  const parts: [number, number][] = [[skin[0], 0.5]];
  if (hair) parts.push([hair[0], 0.3]);
  if (eyes) parts.push([eyes[0], 0.2]);
  const wsum = parts.reduce((a, [, w]) => a + w, 0);
  const overall = parts.reduce((a, [l, w]) => a + l * w, 0) / wsum;
  const depth = clamp((52 - overall) / 14);

  // clarity: contrast between skin and the darker of hair/eyes (+ a little skin chroma)
  let clarity = 0;
  if (hair || eyes) {
    const dark = Math.min(hair ? hair[0] : 100, eyes ? eyes[0] : 100);
    clarity = clamp((skin[0] - dark - 38) / 22);
  }

  let evidence = 1;
  if (!hair) { evidence -= 0.15; notes.push("Couldn't read hair colour"); }
  if (!eyes) { evidence -= 0.1; notes.push("Couldn't read eye colour"); }
  if ((s.castChroma ?? 0) > 14) { evidence -= 0.25; notes.push("Strong colour cast in the photo — try daylight by a window"); }
  if (s.exposure != null && (s.exposure < 70 || s.exposure > 225)) { evidence -= 0.25; notes.push(s.exposure < 70 ? "Photo is quite dark" : "Photo is overexposed"); }
  return { warmth, depth, clarity, evidence: clamp(evidence, 0.2, 1), notes };
}

export type QuizAnswers = Partial<{
  veins: "green" | "blue" | "both";
  metal: "gold" | "silver" | "both";
  hair: "blonde-light" | "blonde-dark" | "red" | "brown-light" | "brown-dark" | "black";
  eyes: "light-blue-grey" | "green-hazel" | "brown" | "dark-brown";
  sun: "burn" | "tan-golden" | "tan-deep" | "freckle";
  contrast: "high" | "medium" | "low";
}>;

const Q: { [K in keyof Required<QuizAnswers>]: Record<string, Partial<Axes>> } = {
  veins: { green: { warmth: 1 }, blue: { warmth: -1 }, both: { warmth: 0 } },
  metal: { gold: { warmth: 1 }, silver: { warmth: -1 }, both: { warmth: 0 } },
  hair: {
    "blonde-light": { depth: -0.9 }, "blonde-dark": { depth: -0.3 }, red: { depth: 0.1, warmth: 0.8 },
    "brown-light": { depth: 0.1 }, "brown-dark": { depth: 0.6 }, black: { depth: 1 },
  },
  eyes: {
    "light-blue-grey": { depth: -0.6, warmth: -0.3 }, "green-hazel": { depth: -0.1, warmth: 0.4 },
    brown: { depth: 0.4 }, "dark-brown": { depth: 0.9 },
  },
  sun: { burn: { warmth: -0.5, depth: -0.4 }, "tan-golden": { warmth: 0.8 }, "tan-deep": { depth: 0.5 }, freckle: { warmth: 0.5, clarity: -0.2 } },
  contrast: { high: { clarity: 1 }, medium: { clarity: 0 }, low: { clarity: -1 } },
};

/** Average of the axes implied by the answers given (undefined where nothing was answered). */
export function readQuiz(a: QuizAnswers): { axes: Partial<Axes>; answered: number } {
  const acc: Record<keyof Axes, number[]> = { warmth: [], depth: [], clarity: [] };
  let answered = 0;
  for (const [q, v] of Object.entries(a) as [keyof QuizAnswers, string][]) {
    const m = Q[q]?.[v];
    if (!m) continue;
    answered++;
    for (const k of Object.keys(m) as (keyof Axes)[]) acc[k].push(m[k]!);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : undefined);
  return { axes: { warmth: avg(acc.warmth), depth: avg(acc.depth), clarity: avg(acc.clarity) }, answered };
}

export type Combined = SeasonGuess & { axes: Axes; photos: number; quizAnswered: number; agreement: number; notes: string[] };

/**
 * Combine several photos and the quiz. Photos are weighted by evidence; the quiz counts as one
 * photo-equivalent when ≥3 answers. Disagreement between photos lowers confidence.
 */
export function combine(photos: PhotoReading[], quiz: QuizAnswers = {}): Combined | null {
  const q = readQuiz(quiz);
  if (!photos.length && q.answered < 2) return null;

  const keys: (keyof Axes)[] = ["warmth", "depth", "clarity"];
  const axes = { warmth: 0, depth: 0, clarity: 0 } as Axes;
  for (const k of keys) {
    let num = 0, den = 0;
    for (const p of photos) { num += p[k] * p.evidence; den += p.evidence; }
    const qv = q.axes[k];
    if (qv != null) { const w = q.answered >= 3 ? 0.8 : 0.4; num += qv * w; den += w; }
    axes[k] = den ? num / den : 0;
  }

  // agreement: how consistently the individual photos land in the same season
  let agreement = 1;
  if (photos.length > 1) {
    const seasons = photos.map((p) => classifySeason(p).key);
    const top = Math.max(...[...new Set(seasons)].map((k) => seasons.filter((s) => s === k).length));
    agreement = top / photos.length;
  }
  const evidence = Math.min(1, (photos.reduce((a, p) => a + p.evidence, 0) + (q.answered >= 3 ? 0.8 : q.answered ? 0.4 : 0)) / 2);
  const guess = classifySeason(axes, evidence);
  const confidence = Math.round(guess.confidence * (0.55 + 0.45 * agreement) * 100) / 100;
  const notes = photos.flatMap((p) => p.notes).filter((n, i, arr) => arr.indexOf(n) === i);
  if (photos.length > 1 && agreement < 0.67) notes.push("Your photos gave different seasons — treat this as a starting point and compare the palettes by eye");
  if (photos.length === 1) notes.push("One photo is a weak basis — add two more in different light to cross-check");
  return { ...guess, confidence, axes, photos: photos.length, quizAnswered: q.answered, agreement, notes };
}
