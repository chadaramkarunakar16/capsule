// Path builders for the head-and-shoulders illustrations (and the glasses overlay on a photo). Pure maths, no DOM.
import type { FaceShape } from "../style/face";
import type { HairIllus } from "./catalog";

export const HEAD = { w: 300, h: 380, cx: 150, cy: 170 };

type Pt = [number, number];
const r = (n: number) => Math.round(n * 10) / 10;
const P = (pts: Pt[]) => pts.map(([x, y]) => `${r(x)} ${r(y)}`);

/** Closed smooth curve through points (Catmull–Rom → cubic Bézier). */
export function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${P([c1, c2, p2]).join(", ")}`;
  }
  return d + " Z";
}

/** Proportions per face shape: cheek half-width, jaw half-width, forehead half-width, length, chin roundness (1 round … 0 pointed). */
export const FACE_PARAMS: Record<FaceShape, { w: number; jw: number; fw: number; L: number; chin: number }> = {
  oval: { w: 0.82, jw: 0.62, fw: 0.72, L: 1.0, chin: 0.62 },
  round: { w: 0.92, jw: 0.8, fw: 0.82, L: 0.88, chin: 0.9 },
  square: { w: 0.86, jw: 0.84, fw: 0.82, L: 0.93, chin: 0.45 },
  oblong: { w: 0.74, jw: 0.64, fw: 0.7, L: 1.17, chin: 0.6 },
  heart: { w: 0.86, jw: 0.5, fw: 0.9, L: 1.0, chin: 0.2 },
  diamond: { w: 0.9, jw: 0.56, fw: 0.64, L: 1.02, chin: 0.3 },
};

export function anchors(shape: FaceShape) {
  const { cx, cy } = HEAD;
  const p = FACE_PARAMS[shape];
  const L = p.L;
  return {
    ...p, cx, cy,
    topY: cy - L * 98, hairlineY: cy - L * 62, eyeY: cy - L * 8, eyeDx: p.w * 38,
    noseY: cy + L * 18, mouthY: cy + L * 36, jawY: cy + L * 42, chinY: cy + L * 82,
    cheekX: p.w * 100, jawX: p.jw * 100, templeX: p.fw * 80,
  };
}

export function headPath(shape: FaceShape): string {
  const a = anchors(shape);
  const { cx, cy, L } = a;
  const chinW = 10 + a.chin * 36;
  const right: Pt[] = [[cx + a.templeX, cy - L * 70], [cx + a.cheekX, cy - L * 8], [cx + a.jawX, cy + L * 40], [cx + chinW, cy + L * 72]];
  const left: Pt[] = right.map(([x, y]) => [2 * cx - x, y] as Pt).reverse();
  return smoothClosed([[cx, a.topY], ...right, [cx, a.chinY], ...left]);
}

/** Neck and shoulders, drawn behind the head. */
export function bodyPath(): string {
  const { cx } = HEAD;
  return `M ${cx - 34} 232 L ${cx - 34} 268 C ${cx - 34} 286 ${cx - 120} 288 ${cx - 150} 318 L ${cx - 150} 380 L ${cx + 150} 380 L ${cx + 150} 318 C ${cx + 120} 288 ${cx + 34} 286 ${cx + 34} 268 L ${cx + 34} 232 Z`;
}

/* ------------------------------------------------------------------ hair */

export type HairShapes = { back: string[]; front: string[]; fadeBands: { d: string; opacity: number }[]; strands: string[]; curls: { x: number; y: number; r: number }[]; opacity: number };

export function hairShapes(h: HairIllus, shape: FaceShape): HairShapes {
  const a = anchors(shape);
  const { cx, cy, L } = a;
  const V = h.top * L * 64;
  const tx = a.templeX + 8;
  const back: string[] = [], front: string[] = [], strands: string[] = [], curls: HairShapes["curls"] = [];
  const fadeBands: HairShapes["fadeBands"] = [];
  const buzz = h.length === "buzz";

  // ---- back layer: length behind the head
  const bottomFor = { buzz: 0, short: 0, chin: cy + L * 44, shoulder: cy + L * 128, long: Math.min(cy + L * 190, 364) }[h.length];
  const sideW = a.cheekX + (h.length === "long" ? 22 : h.length === "shoulder" ? 18 : 12) + h.top * 10;
  if (bottomFor > 0 && !h.extra) {
    back.push(`M ${r(cx - sideW)} ${r(cy - L * 40)} Q ${r(cx - sideW - 6)} ${r(bottomFor - 20)} ${r(cx - sideW + 8)} ${r(bottomFor)} L ${r(cx + sideW - 8)} ${r(bottomFor)} Q ${r(cx + sideW + 6)} ${r(bottomFor - 20)} ${r(cx + sideW)} ${r(cy - L * 40)} Z`);
  }
  if (h.extra === "afro") {
    const rx = a.cheekX + 34 + h.top * 28, ry = L * 100 + h.top * 56;
    back.push(`M ${cx - rx} ${cy - L * 24} A ${r(rx)} ${r(ry)} 0 1 1 ${cx + rx} ${cy - L * 24} Q ${cx + rx - 6} ${cy + L * 20} ${cx + a.cheekX} ${cy + L * 20} L ${cx - a.cheekX} ${cy + L * 20} Q ${cx - rx + 6} ${cy + L * 20} ${cx - rx} ${cy - L * 24} Z`);
  }
  if (h.extra === "ponytail") strands.push(`M ${cx + sideW - 10} ${cy - L * 50} Q ${cx + sideW + 30} ${cy + L * 40} ${cx + sideW - 4} ${cy + L * 150}`);
  if (h.extra === "braids" || h.extra === "locs") {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = cx - sideW + 8 + t * (sideW * 2 - 16), y0 = cy - L * 90 + Math.abs(t - 0.5) * 50;
      const sway = h.extra === "braids" ? 0 : (i % 2 ? 6 : -6);
      strands.push(`M ${r(x)} ${r(y0)} Q ${r(x + sway)} ${r(cy + L * 60)} ${r(x + (t - 0.5) * 30)} ${r(Math.min(cy + L * 180, 362))}`);
    }
  }

  // ---- front layer: cap + fringe
  const outerTop = a.topY - V;
  const cap = `M ${r(cx - tx)} ${r(cy - L * 52)} Q ${r(cx - tx - 20)} ${r(outerTop + 18)} ${r(cx)} ${r(outerTop)} Q ${r(cx + tx + 20)} ${r(outerTop + 18)} ${r(cx + tx)} ${r(cy - L * 52)}`;
  if (buzz) {
    front.push(`${cap} Q ${r(cx)} ${r(a.hairlineY + 6)} ${r(cx - tx)} ${r(cy - L * 52)} Z`);
  } else if (h.fringe === "full") {
    front.push(`${cap} L ${r(cx + tx - 4)} ${r(cy - L * 36)} Q ${r(cx)} ${r(cy - L * 30)} ${r(cx - tx + 4)} ${r(cy - L * 36)} Z`);
  } else if (h.fringe === "side") {
    front.push(`${cap} L ${r(cx + tx - 6)} ${r(cy - L * 50)} Q ${r(cx + 30)} ${r(cy - L * 44)} ${r(cx - 10)} ${r(cy - L * 30)} Q ${r(cx - tx + 8)} ${r(cy - L * 44)} ${r(cx - tx)} ${r(cy - L * 52)} Z`);
  } else if (h.fringe === "curtain") {
    front.push(`${cap} L ${r(cx + tx)} ${r(cy - L * 30)} Q ${r(cx + 40)} ${r(cy - L * 50)} ${r(cx + 4)} ${r(a.hairlineY - 8)} Q ${r(cx - 40)} ${r(cy - L * 50)} ${r(cx - tx)} ${r(cy - L * 30)} Z`);
  } else {
    const dip = h.part === "side" ? 8 : 0;
    front.push(`${cap} Q ${r(cx + 10)} ${r(a.hairlineY - 6 + dip)} ${r(cx - tx)} ${r(cy - L * 52)} Z`);
  }
  // hair that frames the face at the sides, for chin-length and longer
  if (!buzz && (h.length === "chin" || h.length === "shoulder" || h.length === "long") && !h.extra) {
    const lower = h.length === "chin" ? cy + L * 40 : h.length === "shoulder" ? cy + L * 96 : cy + L * 120;
    for (const s of [-1, 1]) {
      const x0 = cx + s * (tx - 2), x1 = cx + s * (a.cheekX + 6), x2 = cx + s * (a.jawX + 12);
      front.push(`M ${r(x0)} ${r(cy - L * 54)} Q ${r(x1 + s * 4)} ${r(cy - L * 6)} ${r(x2)} ${r(lower)} L ${r(x2 - s * 22)} ${r(lower - 4)} Q ${r(x1 - s * 16)} ${r(cy - L * 6)} ${r(x0 - s * 10)} ${r(cy - L * 40)} Z`);
    }
  }
  // fade / taper shading at the sides
  if (h.sides === "fade" || h.sides === "tapered") {
    for (const s of [-1, 1]) {
      const x = cx + s * (a.cheekX - 4);
      fadeBands.push({ d: `M ${r(cx + s * tx)} ${r(cy - L * 54)} Q ${r(x + s * 2)} ${r(cy - L * 40)} ${r(x)} ${r(cy - L * 6)} L ${r(x - s * 12)} ${r(cy - L * 10)} Q ${r(cx + s * (tx - 12))} ${r(cy - L * 36)} ${r(cx + s * (tx - 10))} ${r(cy - L * 52)} Z`, opacity: h.sides === "fade" ? 0.32 : 0.55 });
    }
  }
  // texture: clusters along the top edge for curls
  if (h.wave >= 0.5 || h.extra === "afro") {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, ang = Math.PI * (1 - t);
      curls.push({ x: cx + Math.cos(ang) * (tx + 8), y: cy - L * 52 - Math.sin(ang) * (L * 52 + 6 + V) , r: 10 + h.wave * 4 });
    }
  }
  if (h.extra === "bun") curls.push({ x: cx, y: outerTop - 22, r: 26 });
  return { back, front, fadeBands, strands, curls, opacity: buzz ? 0.55 : 1 };
}

export function partLine(h: HairIllus, shape: FaceShape): string | null {
  if (h.part === "none" || h.fringe === "curtain" || h.length === "buzz") return null;
  const a = anchors(shape);
  const x = h.part === "center" ? a.cx : a.cx - 34;
  return `M ${r(x)} ${r(a.topY - h.top * a.L * 40)} Q ${r(x + 4)} ${r(a.hairlineY - 18)} ${r(x + 2)} ${r(a.hairlineY - 2)}`;
}

/* ------------------------------------------------------------------ facial hair */

const mouth = (a: ReturnType<typeof anchors>) => a.mouthY;
const moustache = (a: ReturnType<typeof anchors>, w = 28) => {
  const y = mouth(a) - 6;
  return `M ${a.cx - w} ${r(y + 2)} Q ${a.cx - w / 2} ${r(y - 12)} ${a.cx} ${r(y - 4)} Q ${a.cx + w / 2} ${r(y - 12)} ${a.cx + w} ${r(y + 2)} Q ${a.cx + w / 2} ${r(y + 4)} ${a.cx} ${r(y + 2)} Q ${a.cx - w / 2} ${r(y + 4)} ${a.cx - w} ${r(y + 2)} Z`;
};

export type BeardKind = "none" | "stubble" | "short" | "full" | "goatee" | "vandyke" | "circle" | "strap";
export function beardShapes(kind: BeardKind, length: number, shape: FaceShape): { fills: { d: string; opacity: number }[]; lines: string[] } {
  const a = anchors(shape);
  const { cx, L } = a;
  const chinW = 10 + a.chin * 36;
  const extra = length * 22;
  const fills: { d: string; opacity: number }[] = [], lines: string[] = [];
  // the band that follows the jaw from ear to ear, as thick as `inner` says
  const band = (innerY: number, drop: number) => {
    const xs = a.cheekX * 0.97, jx = a.jawX * 0.99;
    return `M ${r(cx - xs)} ${r(a.cy + L * 6)} L ${r(cx - jx)} ${r(a.cy + L * 40)} L ${r(cx - chinW)} ${r(a.cy + L * 72 + drop * 0.4)} Q ${r(cx)} ${r(a.chinY + drop)} ${r(cx + chinW)} ${r(a.cy + L * 72 + drop * 0.4)} L ${r(cx + jx)} ${r(a.cy + L * 40)} L ${r(cx + xs)} ${r(a.cy + L * 6)} L ${r(cx + xs - 14)} ${r(innerY - 6)} Q ${r(cx)} ${r(innerY + 12)} ${r(cx - xs + 14)} ${r(innerY - 6)} Z`;
  };
  const goateePatch = (wTop: number, drop: number, pointed: boolean) =>
    `M ${r(cx - wTop)} ${r(mouth(a) + 4)} Q ${r(cx - wTop - 4)} ${r(a.cy + L * 62)} ${r(cx - chinW + 4)} ${r(a.cy + L * 74)} ${pointed ? `L ${r(cx)} ${r(a.chinY + drop + 8)} L ${r(cx + chinW - 4)} ${r(a.cy + L * 74)}` : `Q ${r(cx)} ${r(a.chinY + drop)} ${r(cx + chinW - 4)} ${r(a.cy + L * 74)}`} Q ${r(cx + wTop + 4)} ${r(a.cy + L * 62)} ${r(cx + wTop)} ${r(mouth(a) + 4)} Q ${r(cx)} ${r(mouth(a) + 14)} ${r(cx - wTop)} ${r(mouth(a) + 4)} Z`;
  switch (kind) {
    case "none": break;
    case "stubble": fills.push({ d: band(a.cy + L * 20, 2), opacity: 0.3 }, { d: moustache(a, 26), opacity: 0.28 }); break;
    case "short": fills.push({ d: band(a.cy + L * 24, extra * 0.4), opacity: 0.88 }, { d: moustache(a, 28), opacity: 0.9 }); break;
    case "full": fills.push({ d: band(a.cy + L * 14, extra), opacity: 0.94 }, { d: moustache(a, 32), opacity: 0.96 }); break;
    case "goatee": fills.push({ d: goateePatch(22, extra * 0.4, false), opacity: 0.9 }, { d: moustache(a, 24), opacity: 0.88 }); break;
    case "vandyke": fills.push({ d: goateePatch(16, extra * 0.6, true), opacity: 0.92 }, { d: moustache(a, 34), opacity: 0.92 }); break;
    case "circle": fills.push({ d: goateePatch(24, extra * 0.3, false), opacity: 0.9 }, { d: moustache(a, 30), opacity: 0.9 }); break;
    case "strap":
      lines.push(`M ${r(cx - a.cheekX * 0.96)} ${r(a.cy + L * 4)} L ${r(cx - a.jawX * 0.99)} ${r(a.cy + L * 40)} L ${r(cx - chinW)} ${r(a.cy + L * 72)} Q ${r(cx)} ${r(a.chinY + 2)} ${r(cx + chinW)} ${r(a.cy + L * 72)} L ${r(cx + a.jawX * 0.99)} ${r(a.cy + L * 40)} L ${r(cx + a.cheekX * 0.96)} ${r(a.cy + L * 4)}`);
      break;
  }
  return { fills, lines };
}

/* ------------------------------------------------------------------ glasses */

export type FrameGeom = { lenses: string[]; bridge: string; arms: string[]; brow: string | null; thickness: number; lensW: number; lensH: number };

const rrect = (x: number, y: number, w: number, h: number, rad: number) =>
  `M ${r(x + rad)} ${r(y)} L ${r(x + w - rad)} ${r(y)} Q ${r(x + w)} ${r(y)} ${r(x + w)} ${r(y + rad)} L ${r(x + w)} ${r(y + h - rad)} Q ${r(x + w)} ${r(y + h)} ${r(x + w - rad)} ${r(y + h)} L ${r(x + rad)} ${r(y + h)} Q ${r(x)} ${r(y + h)} ${r(x)} ${r(y + h - rad)} L ${r(x)} ${r(y + rad)} Q ${r(x)} ${r(y)} ${r(x + rad)} ${r(y)} Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${r(cx - rx)} ${r(cy)} A ${r(rx)} ${r(ry)} 0 1 0 ${r(cx + rx)} ${r(cy)} A ${r(rx)} ${r(ry)} 0 1 0 ${r(cx - rx)} ${r(cy)} Z`;

/**
 * Frame outline centred on (cx, cy) with total width `width`, front-on.
 * Lens path for a given style, mirrored for the second lens (outer corner = side with `s`).
 */
export function framePaths(style: string, cx: number, cy: number, width: number): FrameGeom {
  const lw = width * 0.4, gap = width * 0.12;
  const hMul: Record<string, number> = { round: 1, oval: 0.78, rectangular: 0.6, square: 0.82, aviator: 0.92, "cat-eye": 0.7, browline: 0.64, geometric: 0.86, panto: 0.86, rimless: 0.74, oversized: 1.02 };
  const lh = lw * (hMul[style] ?? 0.8);
  const thick = style === "rimless" ? Math.max(1.2, width * 0.008) : style === "browline" ? width * 0.02 : style === "oversized" || style === "square" ? width * 0.032 : width * 0.022;
  const lens = (s: 1 | -1) => {
    const ox = cx + s * (gap / 2 + lw / 2), x = ox - lw / 2, y = cy - lh / 2;
    switch (style) {
      case "round": return ellipse(ox, cy, lw / 2, lh / 2);
      case "oval": return ellipse(ox, cy, lw / 2, lh / 2);
      case "rectangular": return rrect(x, y, lw, lh, lw * 0.06);
      case "square": case "oversized": return rrect(x, y, lw, lh, lw * 0.1);
      case "rimless": return rrect(x, y, lw, lh, lw * 0.22);
      case "browline": return rrect(x, y + lh * 0.08, lw, lh * 0.92, lw * 0.12);
      case "panto": return `M ${r(x + lw * 0.1)} ${r(y + lh * 0.12)} Q ${r(ox)} ${r(y - lh * 0.06)} ${r(x + lw * 0.9)} ${r(y + lh * 0.12)} Q ${r(x + lw)} ${r(cy + lh * 0.2)} ${r(ox)} ${r(y + lh)} Q ${r(x)} ${r(cy + lh * 0.2)} ${r(x + lw * 0.1)} ${r(y + lh * 0.12)} Z`;
      case "aviator": return `M ${r(x)} ${r(y + lh * 0.1)} Q ${r(ox)} ${r(y - lh * 0.08)} ${r(x + lw)} ${r(y + lh * 0.1)} Q ${r(x + lw * 0.98)} ${r(y + lh * 0.82)} ${r(ox)} ${r(y + lh)} Q ${r(x + lw * 0.02)} ${r(y + lh * 0.82)} ${r(x)} ${r(y + lh * 0.1)} Z`;
      case "cat-eye": { const up = s === 1 ? 1 : -1; return `M ${r(ox - up * lw * 0.5)} ${r(y + lh * 0.55)} Q ${r(ox - up * lw * 0.3)} ${r(y + lh * 0.05)} ${r(ox + up * lw * 0.1)} ${r(y)} L ${r(ox + up * lw * 0.52)} ${r(y - lh * 0.12)} Q ${r(ox + up * lw * 0.5)} ${r(y + lh * 0.7)} ${r(ox)} ${r(y + lh)} Q ${r(ox - up * lw * 0.45)} ${r(y + lh * 0.95)} ${r(ox - up * lw * 0.5)} ${r(y + lh * 0.55)} Z`; }
      case "geometric": return `M ${r(ox - lw * 0.25)} ${r(y)} L ${r(ox + lw * 0.25)} ${r(y)} L ${r(ox + lw * 0.5)} ${r(cy)} L ${r(ox + lw * 0.25)} ${r(y + lh)} L ${r(ox - lw * 0.25)} ${r(y + lh)} L ${r(ox - lw * 0.5)} ${r(cy)} Z`;
      default: return ellipse(ox, cy, lw / 2, lh / 2);
    }
  };
  const inner = gap / 2;
  const bridge = `M ${r(cx - inner)} ${r(cy - lh * 0.12)} Q ${r(cx)} ${r(cy - lh * 0.36)} ${r(cx + inner)} ${r(cy - lh * 0.12)}`;
  const outer = gap / 2 + lw;
  const arms = [`M ${r(cx - outer)} ${r(cy - lh * 0.2)} L ${r(cx - outer - width * 0.12)} ${r(cy - lh * 0.1)}`, `M ${r(cx + outer)} ${r(cy - lh * 0.2)} L ${r(cx + outer + width * 0.12)} ${r(cy - lh * 0.1)}`];
  const brow = style === "browline" ? rrect(cx - outer, cy - lh / 2 - width * 0.012, outer * 2, lh * 0.2, lh * 0.08) : null;
  return { lenses: [lens(-1), lens(1)], bridge, arms, brow, thickness: thick, lensW: lw, lensH: lh };
}

/* ------------------------------------------------------------------ putting frames on a real photo */

type LM = { x: number; y: number };

/** Where to draw frames on a photo, from MediaPipe face-mesh landmarks (pixel coordinates). */
export function glassesPlacement(lm: LM[]): { cx: number; cy: number; width: number; angle: number } | null {
  if (lm.length < 400) return null;
  const mid = (a: LM, b: LM): LM => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const left = lm.length >= 478 ? lm[468] : mid(lm[33], lm[133]);   // person's right eye appears on image left
  const right = lm.length >= 478 ? lm[473] : mid(lm[362], lm[263]);
  const faceW = Math.hypot(lm[454].x - lm[234].x, lm[454].y - lm[234].y);
  if (!faceW || !isFinite(faceW)) return null;
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  const c = mid(left, right);
  return { cx: c.x, cy: c.y + faceW * 0.015, width: faceW * 0.95, angle };
}
