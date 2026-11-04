// Browser-only: runs MediaPipe on a photo, on this device. Photos are never uploaded or stored.
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { deltaE, medianRgb, rgbToHex, rgbToLab, type RGB } from "./style/color";
import type { PhotoSamples } from "./style/analysis";
import { fromPose, type Body } from "./style/body";
import { faceRatios, type FaceRatios } from "./style/face";

let facePromise: Promise<FaceLandmarker> | null = null;
let posePromise: Promise<PoseLandmarker> | null = null;

async function fileset() {
  const m = await import("@mediapipe/tasks-vision");
  return { m, fs: await m.FilesetResolver.forVisionTasks("/mediapipe/wasm") };
}

// Local build: models are cached by the Node server. Hosted build: Google's public bucket allows direct browser downloads.
const MODEL_CDN: Record<string, string> = {
  "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};
const modelUrl = (n: string) => (process.env.NEXT_PUBLIC_ENGINE === "browser" ? MODEL_CDN[n] : `/api/model/${n}`);

export function loadFace() {
  facePromise ??= (async () => {
    const { m, fs } = await fileset();
    return m.FaceLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: modelUrl("face_landmarker.task") },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })().catch((e) => { facePromise = null; throw e; });
  return facePromise;
}
export function loadPose() {
  posePromise ??= (async () => {
    const { m, fs } = await fileset();
    return m.PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: modelUrl("pose_landmarker_lite.task") },
      runningMode: "IMAGE",
      numPoses: 1,
    });
  })().catch((e) => { posePromise = null; throw e; });
  return posePromise;
}

async function toCanvas(file: Blob, max = 1024) {
  const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * s);
  c.height = Math.round(bm.height * s);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bm, 0, 0, c.width, c.height);
  return { c, ctx };
}

const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Median colour of a disc, ignoring the darkest and brightest pixels (shadows, glints, pupils). */
function patch(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lo = 0.2, hi = 0.8): RGB | null {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(W, Math.ceil(cx + r)), y1 = Math.min(H, Math.ceil(cy + r));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const px: RGB[] = [];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
  if (px.length < 6) return null;
  px.sort((a, b) => lum(a) - lum(b));
  const kept = px.slice(Math.floor(px.length * lo), Math.max(Math.floor(px.length * lo) + 1, Math.ceil(px.length * hi)));
  return medianRgb(kept);
}

type Pt = { x: number; y: number };
const mean = (...p: Pt[]): Pt => ({ x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export type FaceResult =
  | { ok: false; reason: string }
  | { ok: true; samples: PhotoSamples; ratios: FaceRatios | null; swatches: { skin: string; hair: string | null; eyes: string | null } };

export async function analyseFacePhoto(file: Blob): Promise<FaceResult> {
  const { c, ctx } = await toCanvas(file);
  const lmk = await loadFace();
  const res = lmk.detect(c);
  const pts = res.faceLandmarks?.[0];
  if (!pts) return { ok: false, reason: "No face found. Try a front-facing photo with your whole face in the frame and good light." };
  const lm: Pt[] = pts.map((p) => ({ x: p.x * c.width, y: p.y * c.height }));
  const fw = dist(lm[234], lm[454]);
  if (fw < c.width * 0.18) return { ok: false, reason: "Your face is quite small in this photo — move closer or crop in." };

  const r = fw * 0.045;
  const centres = [mean(lm[50], lm[101], lm[118], lm[117]), mean(lm[280], lm[330], lm[347], lm[346]), { x: lm[10].x + (lm[168].x - lm[10].x) * 0.45, y: lm[10].y + (lm[168].y - lm[10].y) * 0.45 }];
  const skin = centres.map((p) => patch(ctx, p.x, p.y, r)).filter((p): p is RGB => !!p);
  if (skin.length < 2) return { ok: false, reason: "Couldn't read skin tone from this photo." };

  // eyes: iris centres (needs the refined 478-point mesh)
  let eyes: RGB[] | null = null;
  if (lm.length >= 478) {
    const irisR = (dist(lm[469], lm[471]) + dist(lm[474], lm[476])) / 4;
    const e = [468, 473].map((i) => patch(ctx, lm[i].x, lm[i].y, Math.max(2, irisR * 0.7), 0.35, 0.9)).filter((p): p is RGB => !!p);
    if (e.length) eyes = e;
  }

  // hair: a patch just above the hairline. Try a few distances (the head is often close to the top edge)
  // and two spots; keep the first that isn't skin or background.
  let hair: RGB[] | null = null;
  const up = { x: lm[10].x - lm[168].x, y: lm[10].y - lm[168].y };
  const skinLab = rgbToLab(medianRgb(skin));
  const corners = [patch(ctx, 8, 8, 8), patch(ctx, c.width - 9, 8, 8), patch(ctx, 8, c.height - 9, 8)].filter((p): p is RGB => !!p);
  const spots: Pt[] = [];
  for (const k of [0.55, 0.4, 0.28, 0.16]) spots.push({ x: lm[10].x + up.x * k, y: lm[10].y + up.y * k }, { x: lm[54].x + up.x * k * 0.8, y: lm[54].y + up.y * k * 0.8 });
  for (const sp of spots) {
    const h = patch(ctx, sp.x, sp.y, fw * 0.045, 0.1, 0.7);
    if (!h) continue;
    const hl = rgbToLab(h);
    const nearBg = corners.some((q) => deltaE(hl, rgbToLab(q)) < 7);
    if (deltaE(hl, skinLab) > 14 && !nearBg) { hair = [h]; break; }
  }

  // lighting sanity: colour cast of the brightest pixels, and skin exposure
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const lums: { l: number; i: number }[] = [];
  for (let i = 0; i < data.length; i += 16) lums.push({ l: data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11, i });
  lums.sort((a, b) => b.l - a.l);
  const topN = lums.slice(0, Math.max(10, Math.floor(lums.length * 0.05)));
  const bright = medianRgb(topN.map(({ i }) => [data[i], data[i + 1], data[i + 2]] as RGB));
  const [, a, b] = rgbToLab(bright);
  const exposure = skin.reduce((s, p) => s + lum(p), 0) / skin.length;

  return {
    ok: true,
    samples: { skin, hair, eyes, castChroma: Math.hypot(a, b), exposure },
    ratios: faceRatios(lm),
    swatches: { skin: rgbToHex(medianRgb(skin)), hair: hair ? rgbToHex(hair[0]) : null, eyes: eyes ? rgbToHex(medianRgb(eyes)) : null },
  };
}

export type BodyResult = { ok: false; reason: string } | { ok: true; body: Body; problems: string[] };

export async function analyseBodyPhoto(file: Blob): Promise<BodyResult> {
  const { c } = await toCanvas(file, 1280);
  const lmk = await loadPose();
  const res = lmk.detect(c);
  const pts = res.landmarks?.[0];
  if (!pts) return { ok: false, reason: "No body found. Stand fully in frame, facing the camera, with your feet visible." };
  const lm = pts.map((p) => ({ x: p.x * c.width, y: p.y * c.height, visibility: p.visibility }));
  const r = fromPose(lm);
  if (!r) return { ok: false, reason: "Couldn't find your shoulders, hips and ankles clearly." };
  return { ok: true, body: r.body, problems: r.problems };
}

export type FaceLandmarksResult =
  | { ok: false; reason: string }
  | { ok: true; canvas: HTMLCanvasElement; landmarks: { x: number; y: number }[] };

/** Face-mesh landmarks (pixel coordinates) on a photo, plus the downscaled canvas they refer to. Photo stays on this device. */
export async function detectFaceLandmarks(file: Blob, max = 1100): Promise<FaceLandmarksResult> {
  const { c } = await toCanvas(file, max);
  const lmk = await loadFace();
  const pts = lmk.detect(c).faceLandmarks?.[0];
  if (!pts) return { ok: false, reason: "No face found. Try a front-facing photo with your whole face in the frame and good light." };
  return { ok: true, canvas: c, landmarks: pts.map((p) => ({ x: p.x * c.width, y: p.y * c.height })) };
}
