import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, all, fail, get, ok } from "@/lib/db";
import { aiReady, askJSON } from "@/lib/ai";
import { ADVISOR_RULES, brief } from "@/lib/knowledge";
import { BEARDS, FRAMES, HAIRSTYLES } from "@/lib/grooming/catalog";
import { suggestBeards, suggestFrames, suggestHair } from "@/lib/grooming/suggest";
import { normalizeProfile } from "@/lib/style/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const str = (v: unknown, n = 400) => String(v ?? "").slice(0, n);
const list = (v: unknown) => (Array.isArray(v) ? v : []);

/**
 * body: { topic: "grooming" | "outfits", occasion?: string, useFacePhoto?: boolean }
 * The model reads the knowledge brief for this person first, then picks only from options Capsule actually has
 * (catalogue ids for grooming, closet items for outfits), so every suggestion can be shown and acted on.
 */
export async function POST(req: Request) {
  if (!aiReady()) return ok({ available: false });
  const b = await req.json().catch(() => null);
  const topic = b?.topic === "outfits" ? "outfits" : b?.topic === "grooming" ? "grooming" : null;
  if (!topic) return fail("topic must be grooming or outfits");

  const row = get("SELECT data FROM profile WHERE id = 1");
  let p = normalizeProfile(null);
  try { if (row) p = normalizeProfile(JSON.parse(row.data)); } catch { /* defaults */ }
  const know = brief(p, topic);

  try {
    if (topic === "grooming") {
      const hair = suggestHair(p).slice(0, 8), beards = suggestBeards(p).slice(0, 5), frames = suggestFrames(p).slice(0, 6);
      const opt = (r: { item: { id: string; name: string } }) => `${r.item.id} = ${r.item.name}`;
      let image: Uint8Array | undefined, mime: string | undefined, hasPhoto = false;
      const name = p.avatar.facePhoto;
      if (b?.useFacePhoto && name && /^[\w.-]+$/.test(name) && fs.existsSync(path.join(UPLOAD_DIR, name))) {
        image = new Uint8Array(fs.readFileSync(path.join(UPLOAD_DIR, name)));
        mime = MIME[path.extname(name).toLowerCase()] ?? "image/jpeg";
        hasPhoto = true;
      }
      const prompt = [
        ADVISOR_RULES, "", know, "",
        hasPhoto ? "A face photo of this person is attached. Use it for what is visible (hairline, hair texture and density, face outline, any glasses or beard) and mention what you noticed; if it disagrees with the profile's face shape, trust the profile." : "No photo is attached; use the profile only.",
        "", "OPTIONS (choose only from these ids)",
        `Hair: ${hair.map(opt).join("; ")}`,
        p.grooming.facialHair ? `Beard: ${beards.map(opt).join("; ")}` : "Beard: the person has not asked for facial-hair ideas, return an empty list.",
        `Glasses frames: ${frames.map(opt).join("; ")}`,
        "", 'Reply with ONE JSON object: {"summary":"2-3 sentences on what to aim for with this face and hair","hair":[{"id":"","why":"one sentence tied to this person"}],"beard":[{"id":"","why":""}],"glasses":[{"id":"","why":""}],"sunglasses":"one line","tips":["up to 4 short, specific grooming tips for this person"]}. Max 3 hair, 2 beard, 3 glasses.',
      ].join("\n");
      const j = (await askJSON("advice", { image, mime, prompt, maxTokens: 900 })) as Record<string, unknown>;
      const pick = (v: unknown, valid: { id: string }[], n: number) =>
        list(v).map((x) => ({ id: str((x as { id?: string })?.id, 60), why: str((x as { why?: string })?.why) })).filter((x) => valid.some((c) => c.id === x.id)).slice(0, n);
      return ok({
        available: true, usedPhoto: hasPhoto,
        advice: {
          summary: str(j.summary, 700),
          hair: pick(j.hair, HAIRSTYLES, 3),
          beard: p.grooming.facialHair ? pick(j.beard, BEARDS, 2) : [],
          glasses: pick(j.glasses, FRAMES, 3),
          sunglasses: str(j.sunglasses, 240),
          tips: list(j.tips).map((t) => str(t, 220)).filter(Boolean).slice(0, 4),
        },
      });
    }

    // outfits: advice grounded in the closet
    const items = all("SELECT name, category, color_name, fit, formality FROM items WHERE status = 'active' ORDER BY created_at DESC LIMIT 60");
    const closet = items.map((i) => `${i.name || i.category} [${i.category}, ${i.color_name || "colour ?"}${i.fit ? ", " + i.fit : ""}]`);
    const prompt = [
      ADVISOR_RULES, "", know, "",
      `CLOSET (${items.length} pieces; use these exact names)`, closet.length ? closet.join("\n") : "(empty)",
      b?.occasion ? `\nOCCASION: ${str(b.occasion, 80)}` : "",
      "", 'Reply with ONE JSON object: {"summary":"2-3 sentences: what matters most for this person\u2019s build, height, proportions and colouring","do":["up to 5 specific styling moves (layering, fabrics, cuts, colours near the face)"],"avoid":["up to 3 gentle cautions"],"outfits":[{"name":"short name","items":["exact closet names"],"why":"one sentence tied to this person"}]}. Up to 3 outfits, each using only closet pieces; if the closet is empty or too small, return no outfits and say what to add in "do".',
    ].join("\n");
    const j = (await askJSON("advice", { prompt, maxTokens: 1100 })) as Record<string, unknown>;
    const names = new Set(items.map((i) => String(i.name || i.category)));
    return ok({
      available: true,
      advice: {
        summary: str(j.summary, 700),
        do: list(j.do).map((t) => str(t, 260)).filter(Boolean).slice(0, 5),
        avoid: list(j.avoid).map((t) => str(t, 260)).filter(Boolean).slice(0, 3),
        outfits: list(j.outfits).map((o) => ({ name: str((o as { name?: string })?.name, 60), items: list((o as { items?: unknown })?.items).map((x) => str(x, 80)).filter((n) => names.has(n)).slice(0, 6), why: str((o as { why?: string })?.why) })).filter((o) => o.items.length >= 2).slice(0, 3),
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The stylist couldn\u2019t answer", 502);
  }
}
