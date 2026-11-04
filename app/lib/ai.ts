// One place for every AI call. Features ask for what they need; this file picks the cheapest model that does the job.
// Gemini is the main provider (the user's own key). Anthropic stays as an optional fallback for existing setups.
import Anthropic from "@anthropic-ai/sdk";
import { anthropicKey, geminiKey, readSettings, tagModel, writeSettings } from "./settings";

export type Feature = "tag" | "split" | "look" | "advice";
export type Quality = "economy" | "better";

/**
 * Prices are USD per 1M tokens (input / output), from Google's pricing page, Nov 2026.
 *  - gemini-3.1-flash-lite  0.25 / 1.50  one garment on a plain background: read colour, type, fit. Easy.
 *  - gemini-3.5-flash-lite  0.30 / 2.50  must place boxes around garments in a busy photo and list several pieces.
 *  - gemini-3.6-flash       0.75 / 3.75  only if "Better" is chosen; more reliable boxes and shopping queries.
 * "advice" (stylist answers from the knowledge brief, optionally with a face photo) is mostly reading and reasoning over text:
 *    Economy uses gemini-3.5-flash-lite, Better uses gemini-3.6-flash.
 * Thinking is set to minimal and images are sent at the lowest useful resolution to keep each call to a fraction of a cent.
 */
export const MODELS: Record<Quality, Record<Feature, string>> = {
  economy: { tag: "gemini-3.1-flash-lite", split: "gemini-3.5-flash-lite", look: "gemini-3.5-flash-lite", advice: "gemini-3.5-flash-lite" },
  better: { tag: "gemini-3.5-flash-lite", split: "gemini-3.6-flash", look: "gemini-3.6-flash", advice: "gemini-3.6-flash" },
};
const IMAGE_DETAIL: Record<Feature, "LOW" | "MEDIUM"> = { tag: "LOW", split: "MEDIUM", look: "MEDIUM", advice: "MEDIUM" };
const LONGEST_SIDE: Record<Feature, number> = { tag: 768, split: 1280, look: 1280, advice: 1024 };

export const quality = (): Quality => (readSettings().aiQuality === "better" ? "better" : "economy");
export const aiReady = () => !!(geminiKey() || anthropicKey());
export const aiProvider = () => (geminiKey() ? "gemini" : anthropicKey() ? "anthropic" : null);

/** Shrinks a photo before it is sent: fewer bytes, same readable detail. Falls back to the original. */
async function shrink(data: Uint8Array, mime: string, side: number): Promise<{ data: Uint8Array; mime: string }> {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(data)], { type: mime }));
      const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const cv = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * k)), Math.max(1, Math.round(bmp.height * k)));
      cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
      const b = await cv.convertToBlob({ type: "image/jpeg", quality: 0.85 });
      return { data: new Uint8Array(await b.arrayBuffer()), mime: "image/jpeg" };
    }
    const sharp = (await import("./sharp")).loadSharp();
    const out = await sharp(data).rotate().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
    return { data: new Uint8Array(out), mime: "image/jpeg" };
  } catch {
    return { data, mime };
  }
}

const b64 = (d: Uint8Array) => {
  let s = "";
  for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
  return btoa(s);
};

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
  } catch { /* usage is best-effort */ }
}

const friendly = (status: number, msg: string) =>
  status === 400 && /API key/i.test(msg) ? "Gemini didn’t accept that key — check it in Me → AI."
  : status === 403 ? "Gemini refused the request (key restricted or Gemini API not enabled for it)."
  : status === 429 ? "Gemini says you’ve hit a rate or quota limit. Wait a minute, or check your plan in Google AI Studio."
  : `Gemini error ${status}: ${msg.slice(0, 160)}`;

async function gemini(model: string, feature: Feature, prompt: string, img: { data: Uint8Array; mime: string } | null, maxTokens: number) {
  const url = `${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`; // base override is for tests
  const body = (extra: boolean) => JSON.stringify({
    contents: [{ role: "user", parts: [...(img ? [{ inline_data: { mime_type: img.mime, data: b64(img.data) } }] : []), { text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: maxTokens,
      temperature: 0.2,
      ...(extra ? { thinkingConfig: { thinkingLevel: "minimal" }, ...(img ? { mediaResolution: `MEDIA_RESOLUTION_${IMAGE_DETAIL[feature]}` } : {}) } : {}),
    },
  });
  const call = (extra: boolean) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() }, body: body(extra) });
  let r = await call(true);
  if (r.status === 400) {
    const t = await r.clone().text();
    if (/thinking|mediaResolution|media_resolution|Unknown name/i.test(t)) r = await call(false); // model doesn't take the cost-saving options
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(r.status, j?.error?.message ?? ""));
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no answer (the photo may have been blocked).");
  note(model, j.usageMetadata?.promptTokenCount ?? 0, (j.usageMetadata?.candidatesTokenCount ?? 0) + (j.usageMetadata?.thoughtsTokenCount ?? 0));
  return text;
}

async function claude(prompt: string, img: { data: Uint8Array; mime: string } | null, maxTokens: number) {
  const client = new Anthropic({ apiKey: anthropicKey() });
  const msg = await client.messages.create({
    model: tagModel(),
    max_tokens: maxTokens,
    messages: [{ role: "user", content: [
      ...(img ? [{ type: "image" as const, source: { type: "base64" as const, media_type: img.mime as "image/jpeg", data: b64(img.data) } }] : []),
      { type: "text" as const, text: prompt },
    ] }],
  });
  return msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
}

/** Sends one photo + prompt, returns the parsed JSON object the model answered with. */
export async function askJSON(feature: Feature, o: { image?: Uint8Array; mime?: string; prompt: string; maxTokens?: number }): Promise<Record<string, unknown>> {
  const img = o.image ? await shrink(o.image, o.mime ?? "image/jpeg", LONGEST_SIDE[feature]) : null;
  const max = o.maxTokens ?? 900;
  const text = geminiKey() ? await gemini(MODELS[quality()][feature], feature, o.prompt, img, max) : await claude(o.prompt, img, max);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI answered, but not in a form Capsule could read. Try again.");
  return JSON.parse(m[0]);
}

/**
 * Photo try-on with Gemini's image models (USD per image at 1K, Nov 2026):
 *  - gemini-2.5-flash-image  0.039  cheapest model that takes several reference photos (works best with up to 3 images)
 *  - gemini-3.1-flash-image  0.067  better fidelity, up to 14 reference images ("Better" quality)
 * gemini-3.1-flash-lite-image is cheaper still but Google says it is not built for multiple reference inputs, so it is not used.
 */
export const TRYON_MODELS: Record<Quality, { model: string; garmentsPerCall: number }> = {
  economy: { model: "gemini-2.5-flash-image", garmentsPerCall: 2 },
  better: { model: "gemini-3.1-flash-image", garmentsPerCall: 3 },
};

/**
 * The picture of YOU is the one place model quality matters most: it has to be recognisably the same person.
 * gemini-3.1-flash-image keeps a person's identity from reference photos (up to 4 people / 14 references), the cheaper
 * 2.5 model drifts more, so this feature always uses the stronger one (about $0.067 per image) whatever the quality setting.
 */
export const AVATAR_MODEL = "gemini-3.1-flash-image";

export type Img = { data: Uint8Array; mime: string };

/** Sends reference photos + an instruction, returns the picture Gemini made. */
export async function geminiImage(model: string, prompt: string, refs: Img[], opts: { aspect?: string } = {}): Promise<Img> {
  const url = `${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`;
  const body = (withAspect: boolean) => JSON.stringify({
    contents: [{ role: "user", parts: [...refs.map((r) => ({ inline_data: { mime_type: r.mime, data: b64(r.data) } })), { text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.4, ...(withAspect && opts.aspect ? { imageConfig: { aspectRatio: opts.aspect } } : {}) },
  });
  const call = (withAspect: boolean) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() }, body: body(withAspect), signal: AbortSignal.timeout(120_000) });
  let r = await call(true);
  if (r.status === 400 && opts.aspect) {
    const t = await r.clone().text();
    if (/imageConfig|aspect|Unknown name/i.test(t)) r = await call(false); // this model does not take an aspect ratio
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(r.status, j?.error?.message ?? ""));
  const parts: { inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string }; text?: string }[] = j.candidates?.[0]?.content?.parts ?? [];
  const pic = parts.find((p) => p.inlineData || p.inline_data);
  if (!pic) {
    const why = parts.map((p) => p.text).filter(Boolean).join(" ") || j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || "";
    throw new Error(`Gemini didn’t return a picture${why ? ` (${String(why).slice(0, 120)})` : ""}. Try a clearer, front-facing full-body photo.`);
  }
  const d = pic.inlineData ?? { mimeType: pic.inline_data!.mime_type, data: pic.inline_data!.data };
  note(model, j.usageMetadata?.promptTokenCount ?? 0, j.usageMetadata?.candidatesTokenCount ?? 0);
  const bin = atob(d.data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { data: out, mime: d.mimeType };
}
