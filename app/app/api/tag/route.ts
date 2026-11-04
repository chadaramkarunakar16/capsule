import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok } from "@/lib/db";
import { aiReady, askJSON } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Accessories"];

const PROMPT = `You are cataloguing ONE clothing item from a photo for a wardrobe app. Reply with a single JSON object and nothing else.
Fields:
- name: short descriptive name, e.g. "Navy knit polo" (no brand)
- brand: brand if a logo/label is clearly visible, otherwise ""
- category: one of ${CATEGORIES.join(", ")}
- color_name: plain colour name, e.g. "Olive", "Cream", "Light wash denim"
- color_hex: the dominant true colour of the garment as #RRGGBB (ignore background/shadows)
- pattern: solid | striped | checked | floral | graphic | textured | other
- fit: slim | regular | relaxed | oversized | wide | straight | cropped | fitted | "" (if not applicable)
- formality: 1 casual, 2 smart-casual, 3 dressy
- season: all | warm | cool
- attrs: object with any of: neckline, sleeve_length, length, rise, material_guess, closure (omit what does not apply)
Be accurate; do not invent a brand.`;

export async function POST(req: Request) {
  if (!aiReady()) return ok({ aiAvailable: false });
  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (!image || !/^[\w.-]+$/.test(image)) return fail("image required");
  const file = path.join(UPLOAD_DIR, image);
  if (!fs.existsSync(file)) return fail("image not found", 404);
  const ext = path.extname(image).toLowerCase();
  const media = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : "image/jpeg";
  try {
    const j = await askJSON("tag", { image: fs.readFileSync(file), mime: media, maxTokens: 500, prompt: PROMPT }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const hex = /^#[0-9a-fA-F]{6}$/.test(j.color_hex) ? j.color_hex.toLowerCase() : undefined;
    return ok({
      aiAvailable: true,
      tags: {
        name: String(j.name ?? ""),
        brand: String(j.brand ?? ""),
        category: CATEGORIES.includes(j.category) ? j.category : "Tops",
        colorName: String(j.color_name ?? ""),
        colorHex: hex,
        pattern: String(j.pattern ?? "solid"),
        fit: String(j.fit ?? ""),
        formality: [1, 2, 3].includes(Number(j.formality)) ? Number(j.formality) : 1,
        season: ["all", "warm", "cool"].includes(j.season) ? j.season : "all",
        attrs: typeof j.attrs === "object" && j.attrs ? j.attrs : {},
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? `AI tagging failed: ${e.message}` : "AI tagging failed", 502);
  }
}
