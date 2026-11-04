// Neutral descriptions of proportions — used to explain what flatters, never to judge.

export type ShoulderHip = "broader-shoulders" | "balanced" | "broader-hips";
export type TorsoLeg = "longer-torso" | "balanced" | "longer-legs";
export type WaistDef = "defined" | "straight";

export type Body = {
  shoulderHip: ShoulderHip | null;
  torsoLeg: TorsoLeg | null;
  waist: WaistDef | null;
  source: "measurements" | "photo" | "self" | null;
  ratios?: Record<string, number>;
};

export type Measurements = { chest?: number | null; waist?: number | null; hip?: number | null; inseam?: number | null };

export const EMPTY_BODY: Body = { shoulderHip: null, torsoLeg: null, waist: null, source: null };

/** Tape-measure route: circumferences in cm, inseam in cm, height in cm. */
export function fromMeasurements(m: Measurements, height?: number | null): Body {
  const ratios: Record<string, number> = {};
  const body: Body = { ...EMPTY_BODY, source: "measurements", ratios };
  if (m.chest && m.hip) {
    const r = m.chest / m.hip;
    ratios.chestToHip = round(r);
    body.shoulderHip = r > 1.07 ? "broader-shoulders" : r < 0.93 ? "broader-hips" : "balanced";
  }
  if (m.waist && m.chest && m.hip) {
    const r = m.waist / Math.min(m.chest, m.hip);
    ratios.waistToWidest = round(r);
    body.waist = r < 0.82 ? "defined" : "straight";
  }
  if (m.inseam && height) {
    const r = m.inseam / height;
    ratios.inseamToHeight = round(r);
    body.torsoLeg = r > 0.475 ? "longer-legs" : r < 0.43 ? "longer-torso" : "balanced";
  }
  return body;
}

type P = { x: number; y: number; visibility?: number };

/**
 * Pose-landmark route (MediaPipe pose, 33 points, coordinates in pixels). Front-facing, full-body.
 * Returns null when the key landmarks are not clearly visible.
 */
export function fromPose(lm: P[]): { body: Body; problems: string[] } | null {
  const idx = { ls: 11, rs: 12, lh: 23, rh: 24, la: 27, ra: 28 };
  const need = Object.values(idx).map((i) => lm[i]);
  if (need.some((p) => !p)) return null;
  const problems: string[] = [];
  if (need.some((p) => (p.visibility ?? 1) < 0.5)) problems.push("Some joints weren't clearly visible — stand fully in frame, facing the camera");
  const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const sw = d(lm[idx.ls], lm[idx.rs]);
  const hw = d(lm[idx.lh], lm[idx.rh]);
  if (!sw || !hw) return null;
  // MediaPipe puts the hip landmarks at the hip joints, far narrower than real hip breadth, so the raw shoulder:hip ratio
  // is ~1.7 for an average build (measured on a real full-body photo; treat as rough). Divide that out.
  const adj = sw / hw / 1.7;
  const sm = mid(lm[idx.ls], lm[idx.rs]), hm = mid(lm[idx.lh], lm[idx.rh]), am = mid(lm[idx.la], lm[idx.ra]);
  const torso = d(sm, hm), leg = d(hm, am);
  const legShare = leg / (torso + leg);
  const body: Body = {
    shoulderHip: adj > 1.12 ? "broader-shoulders" : adj < 0.9 ? "broader-hips" : "balanced",
    torsoLeg: legShare > 0.655 ? "longer-legs" : legShare < 0.6 ? "longer-torso" : "balanced",
    waist: null, // not reliably visible from joints
    source: "photo",
    ratios: { shoulderToHipAdj: round(adj), legShare: round(legShare) },
  };
  return { body, problems };
}

export const round = (n: number) => Math.round(n * 100) / 100;

export const LABELS = {
  shoulderHip: { "broader-shoulders": "Shoulders broader than hips", balanced: "Shoulders and hips balanced", "broader-hips": "Hips broader than shoulders" },
  torsoLeg: { "longer-torso": "Longer torso", balanced: "Torso and legs balanced", "longer-legs": "Longer legs" },
  waist: { defined: "Defined waist", straight: "Straighter waist" },
} as const;
