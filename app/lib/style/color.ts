// Colour maths shared by the browser and the tests. No DOM access here.

export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]: RGB) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** sRGB (D65) → CIE L*a*b* */
export function rgbToLab([r, g, b]: RGB): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const hexToLab = (hex: string) => rgbToLab(hexToRgb(hex));

export function deltaE(a: Lab, b: Lab) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export type Traits = {
  L: number;
  C: number;
  h: number; // hue angle in degrees, 0..360
  /** −1 (cool) … +1 (warm) */
  warmth: number;
  neutral: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function traits(hex: string): Traits {
  const [L, a, b] = hexToLab(hex);
  const C = Math.hypot(a, b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  // hue 70° (orange) is the warmest, 250° (blue) the coolest; low-chroma colours are damped
  const warmth = Math.cos(((h - 70) * Math.PI) / 180) * clamp(C / 30, 0, 1);
  const beigeLike = h >= 45 && h <= 100 && C < 38 && L > 42; // camel, khaki, cream, tan
  const denimLike = h >= 220 && h <= 295 && C < 28 && L < 62; // navy, indigo, denim
  const neutral = C < 11 || L < 16 || L > 93 || beigeLike || denimLike;
  return { L, C, h, warmth, neutral };
}

export function hueGap(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Median of numbers (does not mutate). */
export function median(xs: number[]) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function medianRgb(px: RGB[]): RGB {
  return [median(px.map((p) => p[0])), median(px.map((p) => p[1])), median(px.map((p) => p[2]))];
}
