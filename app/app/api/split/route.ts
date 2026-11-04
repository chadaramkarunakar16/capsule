import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok } from "@/lib/db";
import { aiReady, askJSON } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Accessories"];

const PROMPT = `This is a photo of a person wearing an outfit (for example a mirror selfie). List each separate garment or accessory they are wearing that is clearly visible: tops, bottoms, dresses, outerwear, shoes, bags. Skip tiny accessories (jewellery, belts, socks) and anything not worn.
Reply with ONE JSON object and nothing else:
{"pieces":[{"name":"short name, e.g. Olive overshirt","category":"one of ${CATEGORIES.join(", ")}","box":[x0,y0,x1,y1]}]}
box = a tight bounding box around just that garment, as integers on a 0-1000 scale relative to the image width and height (x0,y0 top-left, x1,y1 bottom-right). Boxes of layered pieces (e.g. a jacket over a tee) may overlap.`;

export async function POST(req: Request) {
  if (!aiReady()) return ok({ aiAvailable: false });
  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (!image || !/^[\w.-]+$/.test(image)) return fail("image required");
  const file = path.join(UPLOAD_DIR, image);
  if (!fs.existsSync(file)) return fail("image not found", 404);
  const ext = path.extname(image).toLowerCase();
  const media = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  try {
    const j = await askJSON("split", { image: fs.readFileSync(file), mime: media, maxTokens: 800, prompt: PROMPT }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const clamp = (n: unknown) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));
    const pieces = (Array.isArray(j.pieces) ? j.pieces : [])
      .map((p: { name?: string; category?: string; box?: number[] }) => ({
        name: String(p.name ?? ""),
        category: CATEGORIES.includes(String(p.category)) ? String(p.category) : "Tops",
        box: (Array.isArray(p.box) && p.box.length === 4 ? p.box.map(clamp) : [0, 0, 0, 0]) as [number, number, number, number],
      }))
      .filter((p: { box: number[] }) => p.box[2] - p.box[0] > 40 && p.box[3] - p.box[1] > 40)
      .slice(0, 8);
    return ok({ aiAvailable: true, pieces });
  } catch (e) {
    return fail(e instanceof Error ? `Outfit split failed: ${e.message}` : "Outfit split failed", 502);
  }
}
