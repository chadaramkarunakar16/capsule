import type { Feature, ImageTier, Quality } from "./routing";

export type Img = { data: Uint8Array; mime: string };

export type TextReq = { model: string; prompt: string; image: Img | null; maxTokens: number; feature: Feature; lowDetail: boolean; think: boolean; key: string };
export type TextRes = { text: string; inTok: number; outTok: number };

export type ImageReq = { model: string; prompt: string; refs: Img[]; tier: ImageTier; quality: Quality; aspect?: "portrait" | "square"; key: string };
export type ImageRes = { image: Img; inTok: number; outTok: number };

export const b64 = (d: Uint8Array) => {
  let s = "";
  for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s: string) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
