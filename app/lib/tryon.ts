// Photo try-on through FASHN (https://docs.fashn.ai). The user's own API key; photos go to FASHN only when they press the button.
const base = () => process.env.FASHN_BASE_URL || "https://api.fashn.ai";

export type TryonCategory = "tops" | "bottoms" | "one-pieces";
export const CATEGORY_FOR: Record<string, TryonCategory | undefined> = { Tops: "tops", Outerwear: "tops", Bottoms: "bottoms", Dresses: "one-pieces" };

type Status = { id?: string; status?: string; output?: string[]; error?: { name?: string; message?: string } | string | null };

const errText = (e: Status["error"]) => (typeof e === "string" ? e : e ? `${e.name ?? "Error"}${e.message ? `: ${e.message}` : ""}` : "");

async function call(path: string, key: string, init?: RequestInit) {
  const r = await fetch(base() + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
  const j = (await r.json().catch(() => ({}))) as Status;
  if (!r.ok) throw new Error(errText(j.error) || `FASHN request failed (${r.status})`);
  return j;
}

/** Put one garment on the person image; returns the URL of the result image. */
export async function tryOnOne(key: string, modelImage: string, garmentImage: string, category: TryonCategory, opts: { pollMs?: number; maxMs?: number } = {}): Promise<string> {
  const run = await call("/v1/run", key, {
    method: "POST",
    body: JSON.stringify({ model_name: "tryon-v1.6", inputs: { model_image: modelImage, garment_image: garmentImage, category, mode: "balanced", output_format: "jpeg", moderation_level: "permissive" } }),
  });
  if (!run.id) throw new Error(errText(run.error) || "FASHN returned no job id");
  const pollMs = opts.pollMs ?? 2000, deadline = Date.now() + (opts.maxMs ?? 90_000);
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
    const s = await call(`/v1/status/${run.id}`, key);
    if (s.status === "completed") {
      const out = s.output?.[0];
      if (!out) throw new Error("FASHN finished without an image");
      return out;
    }
    if (s.status === "failed") throw new Error(errText(s.error) || "FASHN couldn't make that try-on");
  }
  throw new Error("The try-on took too long — try again");
}
