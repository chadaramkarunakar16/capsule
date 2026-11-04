import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok, uid } from "@/lib/db";
import { fashnKey, tryonProvider } from "@/lib/settings";
import { TRYON_MODELS, geminiImage, quality, type Img } from "@/lib/ai";
import { CATEGORY_FOR, tryOnOne } from "@/lib/tryon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DATA_URI = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_BYTES = 6_000_000;

/**
 * body: { person: dataURI, garments: [{ image: dataURI, category }] }
 * Garments are applied one after another (tops/bottoms/dresses only); each result becomes the next person image.
 * The person's photo is never written to disk — only the final result image is kept.
 */
export async function POST(req: Request) {
  const provider = tryonProvider();
  if (!provider) return ok({ available: false });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.person !== "string" || !Array.isArray(b.garments) || !b.garments.length) return fail("person photo and at least one garment required");
  if (!DATA_URI.test(b.person) || b.person.length > MAX_BYTES * 1.4) return fail("the photo isn't a supported image, or it's too large");
  const garments = (b.garments as { image: string; category: string }[]).slice(0, 3);
  for (const g of garments) {
    if (!DATA_URI.test(g.image ?? "") || g.image.length > MAX_BYTES * 1.4) return fail("a garment image isn't supported or is too large");
    if (!CATEGORY_FOR[g.category]) return fail(`${g.category} can't be tried on yet — tops, bottoms and dresses only`);
  }
  // a dress replaces both tops and bottoms; apply bottoms before tops so tops end up over them
  const order = ["one-pieces", "bottoms", "tops"];
  garments.sort((a, c) => order.indexOf(CATEGORY_FOR[a.category]!) - order.indexOf(CATEGORY_FOR[c.category]!));
  try {
    if (provider === "gemini") {
      const { model, garmentsPerCall } = TRYON_MODELS[quality()];
      const dec = (uri: string): Img => {
        const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(uri)!;
        return { mime: m[1], data: new Uint8Array(Buffer.from(m[2], "base64")) };
      };
      let person = dec(b.person);
      // a few garments at a time keeps each call within what the model handles well; each result becomes the next person photo
      for (let i = 0; i < garments.length; i += garmentsPerCall) {
        const group = garments.slice(i, i + garmentsPerCall);
        const prompt = `Image 1 is a photo of a person. ${group.map((g, k) => `Image ${k + 2} is a ${g.category.toLowerCase()} garment.`).join(" ")} Edit image 1 so the person is wearing ${group.length > 1 ? "these garments" : "this garment"}, replacing the clothing in the same area. Keep the person's face, hair, skin tone, body shape, pose, the background and the lighting exactly the same. Reproduce each garment's real colour, pattern, cut and length faithfully; do not invent logos or text. Output only the edited photo.`;
        person = await geminiImage(model, prompt, [person, ...group.map((g) => dec(g.image))]);
      }
      const ext = person.mime.includes("png") ? "png" : person.mime.includes("webp") ? "webp" : "jpg";
      const name = `${uid()}-tryon.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(person.data));
      return ok({ available: true, image: name, steps: Math.ceil(garments.length / garmentsPerCall), provider });
    }
    const key = fashnKey();
    let current: string = b.person;
    for (const g of garments) current = await tryOnOne(key, current, g.image, CATEGORY_FOR[g.category]!);
    const r = await fetch(current, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error("Couldn't download the result image");
    const ct = r.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const name = `${uid()}-tryon.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await r.arrayBuffer()));
    return ok({ available: true, image: name, steps: garments.length, provider });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Try-on failed", 502);
  }
}
