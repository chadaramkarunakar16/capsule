// Browser-only image helpers: downscale, background removal, trim, colour guess.
import type { Tags } from "./types";

async function bitmap(blob: Blob) {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}
function canvasToBlob(c: HTMLCanvasElement, type: string, q?: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), type, q));
}

/** Downscale to at most `max` px (long side) and re-encode as JPEG (white background). */
export async function downscaleJpeg(blob: Blob, max = 1400): Promise<Blob> {
  const bm = await bitmap(blob);
  const s = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * s);
  c.height = Math.round(bm.height * s);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bm, 0, 0, c.width, c.height);
  return canvasToBlob(c, "image/jpeg", 0.88);
}

/** Crop a transparent PNG to its content with a little padding; cap the size. */
export async function trimPng(blob: Blob, max = 900): Promise<{ blob: Blob; w: number; h: number }> {
  const bm = await bitmap(blob);
  const c = document.createElement("canvas");
  c.width = bm.width;
  c.height = bm.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bm, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { blob, w: bm.width, h: bm.height }; // fully transparent: leave as is
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(c.width - 1, x1 + pad);
  y1 = Math.min(c.height - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const s = Math.min(1, max / Math.max(w, h));
  const out = document.createElement("canvas");
  out.width = Math.round(w * s);
  out.height = Math.round(h * s);
  out.getContext("2d")!.drawImage(c, x0, y0, w, h, 0, 0, out.width, out.height);
  return { blob: await canvasToBlob(out, "image/png"), w: out.width, h: out.height };
}

/** On-device background removal (downloads a small model on first use). */
export async function removeBg(blob: Blob): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(blob, { output: { format: "image/png" } });
}

export { nameColor } from "./style/colornames";
import { nameColor } from "./style/colornames";
import { hexToRgb, rgbToHex } from "./style/color";

/** Dominant colour of the opaque pixels (quantised histogram). */
export async function dominantColor(blob: Blob): Promise<string> {
  const bm = await bitmap(blob);
  const s = 64 / Math.max(bm.width, bm.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bm.width * s));
  c.height = Math.max(1, Math.round(bm.height * s));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bm, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2];
    buckets.set(key, e);
  }
  let top: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of buckets.values()) if (!top || e.n > top.n) top = e;
  return top ? rgbToHex([top.r / top.n, top.g / top.n, top.b / top.n]) : "#cccccc";
}

/** Fallback tags when no AI key is set: colour from pixels, category from silhouette shape. */
export async function guessTags(cutout: Blob, w: number, h: number): Promise<Tags> {
  const hex = await dominantColor(cutout);
  const ratio = w / h;
  const category = ratio > 1.6 ? "Shoes" : ratio < 0.62 ? "Bottoms" : "Tops";
  const colorName = nameColor(hex);
  return { name: `${colorName} ${category === "Bottoms" ? "bottoms" : category === "Shoes" ? "shoes" : "top"}`, category, colorHex: hex, colorName, pattern: "solid", formality: 1, season: "all", fit: "", brand: "" };
}

export function colorDistance(a: string, b: string) {
  const [r, g, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r - r2) ** 2 + (g - g2) ** 2 + (b1 - b2) ** 2);
}

export function blobToDataUri(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("couldn't read image")); r.readAsDataURL(b); });
}
/** Any image (transparent cut-outs included) → JPEG data URI on white, longest side at most `max` px. */
export async function toJpegDataUri(blob: Blob, max = 1100): Promise<string> {
  return blobToDataUri(await downscaleJpeg(blob, max));
}
