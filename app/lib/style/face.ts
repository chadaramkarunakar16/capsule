// Face shape from MediaPipe face-mesh landmarks (478 points, coordinates in pixels).

export type FaceShape = "oval" | "round" | "square" | "oblong" | "heart" | "diamond";
export const FACE_SHAPES: FaceShape[] = ["oval", "round", "square", "oblong", "heart", "diamond"];

type P = { x: number; y: number };
const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

export type FaceRatios = { lengthToWidth: number; foreheadToCheek: number; jawToCheek: number; chinAngle: number };

export function faceRatios(lm: P[]): FaceRatios | null {
  if (lm.length < 400) return null;
  const top = lm[10], chin = lm[152];
  const cheekW = d(lm[234], lm[454]);
  const foreheadW = d(lm[21], lm[251]);
  const jawW = d(lm[58], lm[288]);
  if (!cheekW || !top || !chin) return null;
  // the mesh top (10) sits at the hairline-ish; add a little for the full forehead
  const length = d(top, chin) * 1.1;
  // angle at the chin between the two lower-jaw points: small = pointed, large = broad/square
  const a = lm[172], b = lm[397];
  const v1 = { x: a.x - chin.x, y: a.y - chin.y }, v2 = { x: b.x - chin.x, y: b.y - chin.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  const chinAngle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { lengthToWidth: r(length / cheekW), foreheadToCheek: r(foreheadW / cheekW), jawToCheek: r(jawW / cheekW), chinAngle: Math.round(chinAngle) };
}

const bell = (x: number, mid: number, width: number) => Math.exp(-(((x - mid) / width) ** 2));

export type FaceGuess = { shape: FaceShape; confidence: number; alternatives: FaceShape[]; ratios: FaceRatios };

export function classifyFace(r: FaceRatios): FaceGuess {
  const L = r.lengthToWidth, F = r.foreheadToCheek, J = r.jawToCheek, A = r.chinAngle;
  const score: Record<FaceShape, number> = {
    oval: bell(L, 1.45, 0.14) * bell(J, 0.82, 0.12) * bell(F, 0.88, 0.14),
    round: bell(L, 1.2, 0.12) * bell(J, 0.86, 0.09) * bell(A, 106, 18),
    square: bell(L, 1.24, 0.14) * bell(J, 0.95, 0.08) * bell(A, 124, 18),
    oblong: bell(L, 1.68, 0.16) * bell(J, 0.86, 0.16),
    heart: bell(F, 1.0, 0.1) * bell(J, 0.7, 0.1) * bell(L, 1.45, 0.2),
    diamond: bell(F, 0.76, 0.09) * bell(J, 0.74, 0.1) * bell(L, 1.45, 0.2),
  };
  const ranked = (Object.entries(score) as [FaceShape, number][]).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((a, [, v]) => a + v, 0) || 1;
  const share = ranked[0][1] / total;
  // be modest: face shape from a still photo is a rough call, so cap the confidence
  const confidence = Math.round(Math.min(0.8, 0.3 + share * 0.6) * 100) / 100;
  return { shape: ranked[0][0], confidence, alternatives: ranked.slice(1, 3).map(([s]) => s), ratios: r };
}

export const FACE_BLURB: Record<FaceShape, string> = {
  oval: "Balanced proportions; most necklines and collars work.",
  round: "Soft jaw and similar width and length. Open V and scoop necklines add length.",
  square: "Strong jaw. Rounded and scoop necklines soften; collars with softness work well.",
  oblong: "Longer than wide. Crew, boat and wider collars add width; very deep V adds length.",
  heart: "Wider forehead, narrower chin. Scoop and rounded necklines balance the jaw.",
  diamond: "Cheekbones are the widest point. Scoop, boat and wider necklines balance narrow forehead and jaw.",
};
