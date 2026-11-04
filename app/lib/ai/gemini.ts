// Google Gemini over plain REST (works from the Node server and from the in-browser engine through the relay).
import { b64, unb64, type ImageReq, type ImageRes, type TextReq, type TextRes } from "./types";

const base = () => process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"; // base override is for tests

const friendly = (status: number, msg: string) =>
  status === 400 && /API key/i.test(msg) ? "Gemini didn’t accept that key — check it in Me → AI."
  : status === 403 ? "Gemini refused the request (key restricted, or the Gemini API isn’t enabled for it)."
  : status === 429 ? "Gemini says you’ve hit a rate or quota limit. Wait a minute, or check your plan in Google AI Studio."
  : `Gemini error ${status}: ${msg.slice(0, 160)}`;

export async function geminiText(q: TextReq): Promise<TextRes> {
  const url = `${base()}/v1beta/models/${q.model}:generateContent`;
  const body = (extra: boolean) => JSON.stringify({
    contents: [{ role: "user", parts: [...(q.image ? [{ inline_data: { mime_type: q.image.mime, data: b64(q.image.data) } }] : []), { text: q.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: q.maxTokens,
      temperature: 0.2,
      // cost controls: minimal thinking, and the lowest image detail where a single garment is all there is to read
      ...(extra ? { thinkingConfig: { thinkingLevel: q.think ? "low" : "minimal" }, ...(q.image ? { mediaResolution: q.lowDetail ? "MEDIA_RESOLUTION_LOW" : "MEDIA_RESOLUTION_MEDIUM" } : {}) } : {}),
    },
  });
  const call = (extra: boolean) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": q.key }, body: body(extra) });
  let r = await call(true);
  if (r.status === 400) {
    const t = await r.clone().text();
    if (/thinking|mediaResolution|media_resolution|Unknown name/i.test(t)) r = await call(false); // this model doesn't take the cost-saving options
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(r.status, j?.error?.message ?? ""));
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no answer (the photo may have been blocked).");
  return { text, inTok: j.usageMetadata?.promptTokenCount ?? 0, outTok: (j.usageMetadata?.candidatesTokenCount ?? 0) + (j.usageMetadata?.thoughtsTokenCount ?? 0) };
}

export async function geminiImage(q: ImageReq): Promise<ImageRes> {
  const url = `${base()}/v1beta/models/${q.model}:generateContent`;
  const aspect = q.aspect === "portrait" ? "2:3" : q.aspect === "square" ? "1:1" : undefined;
  const body = (withAspect: boolean) => JSON.stringify({
    contents: [{ role: "user", parts: [...q.refs.map((r) => ({ inline_data: { mime_type: r.mime, data: b64(r.data) } })), { text: q.prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0.4, ...(withAspect && aspect ? { imageConfig: { aspectRatio: aspect } } : {}) },
  });
  const call = (withAspect: boolean) => fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": q.key }, body: body(withAspect), signal: AbortSignal.timeout(120_000) });
  let r = await call(true);
  if (r.status === 400 && aspect) {
    const t = await r.clone().text();
    if (/imageConfig|aspect|Unknown name/i.test(t)) r = await call(false); // this model does not take an aspect ratio
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(r.status, j?.error?.message ?? ""));
  const parts: { inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string }; text?: string }[] = j.candidates?.[0]?.content?.parts ?? [];
  const pic = parts.find((p) => p.inlineData || p.inline_data);
  if (!pic) {
    const why = parts.map((p) => p.text).filter(Boolean).join(" ") || j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || "";
    throw new Error(`Gemini didn’t return a picture${why ? ` (${String(why).slice(0, 120)})` : ""}. Try a clearer, front-facing photo.`);
  }
  const d = pic.inlineData ?? { mimeType: pic.inline_data!.mime_type, data: pic.inline_data!.data };
  return { image: { data: unb64(d.data), mime: d.mimeType }, inTok: j.usageMetadata?.promptTokenCount ?? 0, outTok: j.usageMetadata?.candidatesTokenCount ?? 0 };
}
