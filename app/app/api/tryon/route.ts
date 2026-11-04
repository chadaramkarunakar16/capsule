import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok, uid } from "@/lib/db";
import { aiReady, garmentsPerCall, makeImage, provider, type Img } from "@/lib/ai";
import { note } from "@/lib/brain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DATA_URI = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_BYTES = 6_000_000;
const TRYABLE = new Set(["Tops", "Outerwear", "Bottoms", "Dresses"]);
/** a dress replaces both tops and bottoms; apply bottoms before tops so tops end up over them */
const ORDER = ["Dresses", "Bottoms", "Tops", "Outerwear"];

const dec = (uri: string): Img => {
  const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(uri)!;
  return { mime: m[1], data: new Uint8Array(Buffer.from(m[2], "base64")) };
};

/**
 * body: { person: dataURI, garments: [{ image: dataURI, category }] }
 * The person's photo is never written to disk; only the final result image is kept. Runs on whichever AI service is selected.
 */
export async function POST(req: Request) {
  if (!aiReady()) return ok({ available: false });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.person !== "string" || !Array.isArray(b.garments) || !b.garments.length) return fail("person photo and at least one garment required");
  if (!DATA_URI.test(b.person) || b.person.length > MAX_BYTES * 1.4) return fail("the photo isn't a supported image, or it's too large");
  const garments = (b.garments as { image: string; category: string }[]).slice(0, 4);
  for (const g of garments) {
    if (!DATA_URI.test(g.image ?? "") || g.image.length > MAX_BYTES * 1.4) return fail("a garment image isn't supported or is too large");
    if (!TRYABLE.has(g.category)) return fail(`${g.category} can't be tried on yet — tops, bottoms, dresses and jackets only`);
  }
  garments.sort((a, c) => ORDER.indexOf(a.category) - ORDER.indexOf(c.category));
  try {
    const per = garmentsPerCall();
    let person = dec(b.person);
    // a few garments at a time keeps each call within what the model handles well; each result becomes the next person photo
    for (let i = 0; i < garments.length; i += per) {
      const group = garments.slice(i, i + per);
      const prompt = `Image 1 is a photo of a person. ${group.map((g, k) => `Image ${k + 2} is a ${g.category.toLowerCase()} garment.`).join(" ")} Edit image 1 so the person is wearing ${group.length > 1 ? "these garments" : "this garment"}, replacing the clothing in the same area. Keep the person's face, hair, skin tone, body shape, pose, the background and the lighting exactly the same. Reproduce each garment's real colour, pattern, cut and length faithfully; do not invent logos or text. Output only the edited photo.`;
      person = await makeImage("edit", prompt, [person, ...group.map((g) => dec(g.image))], { aspect: "portrait" });
    }
    const ext = person.mime.includes("png") ? "png" : person.mime.includes("webp") ? "webp" : "jpg";
    const name = `${uid()}-tryon.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(person.data));
    note("tryon", { categories: garments.map((g) => g.category) });
    return ok({ available: true, image: name, steps: Math.ceil(garments.length / per), provider: provider() });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Try-on failed", 502);
  }
}
