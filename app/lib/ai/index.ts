// One place for every AI call in the app. Features say what they need (read / think / edit / likeness); this file picks the
// provider the person chose (Gemini or OpenAI), the smallest model that does the job, and adds the shared AI-brain memory.
import { brainContext } from "../brain/context";
import { geminiKey, openaiKey, readSettings, writeSettings } from "../settings";
import { geminiImage, geminiText } from "./gemini";
import { openaiImage, openaiText } from "./openai";
import { GARMENTS_PER_CALL, LONGEST_SIDE, LOW_DETAIL, ROUTES, TEXT_TIER, type Feature, type ImageTier, type Provider, type Quality, type Tier } from "./routing";
import { b64, type Img } from "./types";

export * from "./routing";
export type { Img } from "./types";

export const quality = (): Quality => (readSettings().aiQuality === "better" ? "better" : "economy");

/** The service in use: the person's pick if its key is saved, else whichever key exists (Gemini first). */
export function provider(): Provider | null {
  const pref = readSettings().aiProvider;
  if (pref === "openai" && openaiKey()) return "openai";
  if (pref === "gemini" && geminiKey()) return "gemini";
  return geminiKey() ? "gemini" : openaiKey() ? "openai" : null;
}
export const aiReady = () => provider() !== null;
export const hasKey = (p: Provider) => (p === "gemini" ? !!geminiKey() : !!openaiKey());
const keyOf = (p: Provider) => (p === "gemini" ? geminiKey() : openaiKey());
export const modelFor = (tier: Tier, p: Provider = provider() ?? "gemini", q: Quality = quality()) => ROUTES[p][q][tier];
export const garmentsPerCall = () => GARMENTS_PER_CALL[provider() ?? "gemini"][quality()];

function need(): Provider {
  const p = provider();
  if (!p) throw new Error("Add an AI key in Me → AI first (Gemini or OpenAI).");
  return p;
}

/** Shrinks a photo before it is sent: fewer bytes, same readable detail. Falls back to the original. */
async function shrink(data: Uint8Array, mime: string, side: number): Promise<Img> {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(data)], { type: mime }));
      const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const cv = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k)));
      cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
      const b = await cv.convertToBlob({ type: "image/jpeg", quality: 0.85 });
      return { data: new Uint8Array(await b.arrayBuffer()), mime: "image/jpeg" };
    }
    const sharp = (await import("../sharp")).loadSharp();
    const out = await sharp(data).rotate().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
    return { data: new Uint8Array(out), mime: "image/jpeg" };
  } catch {
    return { data, mime };
  }
}

function note(model: string, inTok: number, outTok: number) {
  try {
    const s = readSettings();
    const month = new Date().toISOString().slice(0, 7);
    const u = (s.aiUsage ??= {});
    const m = (u[month] ??= { calls: 0, inTok: 0, outTok: 0, byModel: {} });
    m.calls++; m.inTok += inTok; m.outTok += outTok;
    m.byModel[model] = (m.byModel[model] ?? 0) + 1;
    for (const k of Object.keys(u)) if (k < month && Object.keys(u).length > 3) delete u[k];
    writeSettings(s);
  } catch { /* usage counting is best-effort */ }
}

/** Features that get the shared AI-brain memory in front of their prompt. */
const BRAIN_FEATURES = new Set<Feature>(["tag", "split", "look", "advice"]);

/** Sends an optional photo + a prompt, returns the JSON object the model answered with. */
export async function askJSON(feature: Feature, o: { image?: Uint8Array; mime?: string; prompt: string; maxTokens?: number; brain?: boolean }): Promise<Record<string, unknown>> {
  const p = need();
  const tier = TEXT_TIER[feature];
  const image = o.image ? await shrink(o.image, o.mime ?? "image/jpeg", LONGEST_SIDE[feature] || 1024) : null;
  const memory = o.brain !== false && BRAIN_FEATURES.has(feature) ? brainContext(feature) : "";
  const prompt = memory ? `${memory}\n\n${o.prompt}` : o.prompt;
  const model = modelFor(tier, p);
  const req = { model, prompt, image, maxTokens: o.maxTokens ?? 900, feature, lowDetail: LOW_DETAIL.has(feature), think: tier === "think", key: keyOf(p) };
  const r = p === "gemini" ? await geminiText(req) : await openaiText(req);
  note(model, r.inTok, r.outTok);
  const m = r.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI answered, but not in a form Capsule could read. Try again.");
  return JSON.parse(m[0]);
}

/** Edits or creates a picture from reference photos. `edit` = try-on, glasses, cut-outs; `likeness` = the picture of you. */
export async function makeImage(tier: ImageTier, prompt: string, refs: Img[], opts: { aspect?: "portrait" | "square" } = {}): Promise<Img> {
  const p = need();
  const model = modelFor(tier, p);
  const req = { model, prompt, refs, tier, quality: quality(), aspect: opts.aspect, key: keyOf(p) };
  const r = p === "gemini" ? await geminiImage(req) : await openaiImage(req);
  note(model, r.inTok, r.outTok);
  return r.image;
}

export { b64 };
