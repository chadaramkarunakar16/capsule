// OpenAI over plain REST: the Responses API for reading and reasoning, the Images API (edits) for pictures.
import { b64, unb64, type ImageReq, type ImageRes, type TextReq, type TextRes } from "./types";

const base = () => process.env.OPENAI_BASE_URL || "https://api.openai.com"; // base override is for tests

const friendly = (status: number, msg: string) =>
  status === 401 ? "OpenAI didn’t accept that key — check it in Me → AI."
  : status === 403 ? "OpenAI refused the request. Image models may need your organisation to be verified in the OpenAI dashboard."
  : status === 404 ? `OpenAI says this model isn’t available to your account (${msg.slice(0, 100)}).`
  : status === 429 ? "OpenAI says you’ve hit a rate limit or run out of credit. Check your billing in the OpenAI dashboard."
  : `OpenAI error ${status}: ${msg.slice(0, 160)}`;

export async function openaiText(q: TextReq): Promise<TextRes> {
  const url = `${base()}/v1/responses`;
  const body = (extras: boolean) => JSON.stringify({
    model: q.model,
    input: [{ role: "user", content: [
      { type: "input_text", text: q.prompt },
      ...(q.image ? [{ type: "input_image", image_url: `data:${q.image.mime};base64,${b64(q.image.data)}`, ...(extras ? { detail: q.lowDetail ? "low" : "auto" } : {}) }] : []),
    ] }],
    text: { format: { type: "json_object" } },
    // the output budget also covers any reasoning, so leave room when the model is allowed to think
    max_output_tokens: q.think ? q.maxTokens * 2 : q.maxTokens,
    ...(extras ? { reasoning: { effort: q.think ? "low" : "none" } } : {}),
  });
  const call = (extras: boolean) => fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${q.key}` }, body: body(extras) });
  let r = await call(true);
  if (r.status === 400) {
    const t = await r.clone().text();
    if (/reasoning|effort|detail|Unknown parameter|unsupported/i.test(t)) r = await call(false); // this model doesn't take the cost-saving options
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(r.status, j?.error?.message ?? ""));
  const text: string = j.output_text ?? (j.output ?? []).flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? []).filter((c: { type: string }) => c.type === "output_text").map((c: { text?: string }) => c.text ?? "").join("");
  if (!text) throw new Error("OpenAI returned no answer (the photo may have been blocked).");
  return { text, inTok: j.usage?.input_tokens ?? 0, outTok: j.usage?.output_tokens ?? 0 };
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function openaiImage(q: ImageReq): Promise<ImageRes> {
  const url = `${base()}/v1/images/edits`;
  const form = (extras: boolean) => {
    const f = new FormData();
    f.append("model", q.model);
    f.append("prompt", q.prompt);
    q.refs.forEach((r, i) => f.append("image[]", new Blob([new Uint8Array(r.data)], { type: r.mime }), `ref${i + 1}.${EXT[r.mime] ?? "png"}`));
    if (extras) {
      f.append("size", q.aspect === "square" ? "1024x1024" : "1024x1536");
      f.append("quality", q.tier === "likeness" && q.quality === "better" ? "high" : "medium");
      f.append("output_format", "jpeg");
      // older image models need this asked for to keep faces; newer ones keep inputs at high fidelity automatically
      if (q.model.startsWith("gpt-image-1")) f.append("input_fidelity", "high");
    }
    return f;
  };
  const call = (extras: boolean) => fetch(url, { method: "POST", headers: { authorization: `Bearer ${q.key}` }, body: form(extras), signal: AbortSignal.timeout(180_000) });
  let r = await call(true);
  if (r.status === 400) {
    const t = await r.clone().text();
    if (/size|quality|output_format|input_fidelity|Unknown parameter|unsupported/i.test(t)) r = await call(false); // model rejects one of the optional settings
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(r.status, j?.error?.message ?? ""));
  const b = j.data?.[0]?.b64_json;
  if (!b) throw new Error("OpenAI didn’t return a picture. Try a clearer, front-facing photo.");
  return { image: { data: unb64(b), mime: "image/jpeg" }, inTok: j.usage?.input_tokens ?? 0, outTok: j.usage?.output_tokens ?? 0 };
}
