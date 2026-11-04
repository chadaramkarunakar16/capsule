import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, get, ok, run, uid } from "@/lib/db";
import { getLook } from "@/lib/shop/db";
import { aiReady, askJSON } from "@/lib/ai";
import { countryCode } from "@/lib/settings";
import { nameColor } from "@/lib/style/colornames";
import type { Piece } from "@/lib/shop/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Accessories"];

function prompt(direction: string, country: string) {
  const who = direction === "Menswear" ? "men's" : direction === "Womenswear" ? "women's" : "";
  return `This is an outfit inspiration photo (from Instagram, Pinterest or similar). List each distinct clothing item, pair of shoes or bag that is clearly visible so the shopper can find similar pieces online. Skip tiny accessories (jewellery, belts, socks) and anything unclear.
Reply with ONE JSON object and nothing else:
{"pieces":[{"name":"short name, e.g. Olive overshirt","category":"one of ${CATEGORIES.join(", ")}","color_name":"plain colour name","color_hex":"#RRGGBB true garment colour (ignore lighting/shadows)","pattern":"solid|striped|checked|floral|graphic|textured|other","fit":"slim|regular|relaxed|oversized|wide|straight|cropped|fitted|\\"\\"","material":"best guess, e.g. cotton, wool, denim, leather, or \\"\\"","formality":1,"brand":"only if a logo or label is clearly legible, otherwise \\"\\"","query":"a good online-shopping search for a close match, ${who ? `starting with "${who}", ` : ""}including colour, cut and material, e.g. ${who ? `${who} ` : ""}olive green oversized cotton overshirt"}]}
formality: 1 casual, 2 smart-casual, 3 dressy. Maximum 8 pieces. Shopper's region: ${country}. Do not invent brands.`;
}

export async function POST(_r: Request, ctx: RouteContext<"/api/looks/[id]/analyse">) {
  const { id } = await ctx.params;
  const look = getLook(id);
  if (!look) return fail("not found", 404);
  if (!aiReady()) return ok({ aiAvailable: false });
  const file = path.join(UPLOAD_DIR, look.image);
  if (!fs.existsSync(file)) return fail("image missing", 404);
  const ext = path.extname(look.image).toLowerCase();
  const media = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const profile = get("SELECT data FROM profile WHERE id = 1");
  let direction = "";
  try { direction = profile ? JSON.parse(profile.data).basics?.direction ?? "" : ""; } catch { /* none */ }
  try {
    const j = await askJSON("look", { image: fs.readFileSync(file), mime: media, maxTokens: 1400, prompt: prompt(direction, countryCode()) }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const pieces: Piece[] = (Array.isArray(j.pieces) ? j.pieces : []).slice(0, 8).map((p: Record<string, unknown>) => {
      const hex = /^#[0-9a-fA-F]{6}$/.test(String(p.color_hex)) ? String(p.color_hex).toLowerCase() : "#9a9a9a";
      const name = String(p.name ?? "Piece");
      return {
        id: uid(),
        name,
        category: CATEGORIES.includes(String(p.category)) ? String(p.category) : "Tops",
        colorName: String(p.color_name || nameColor(hex)),
        colorHex: hex,
        pattern: String(p.pattern || "solid"),
        fit: String(p.fit || ""),
        material: String(p.material || ""),
        formality: [1, 2, 3].includes(Number(p.formality)) ? Number(p.formality) : 1,
        brand: String(p.brand || ""),
        query: String(p.query || name),
      };
    });
    if (!pieces.length) return fail("No separate pieces were found in this photo", 422);
    run("UPDATE looks SET pieces = ?, analysed = 1 WHERE id = ?", JSON.stringify(pieces), id);
    return ok({ aiAvailable: true, look: getLook(id) });
  } catch (e) {
    return fail(e instanceof Error ? `Look analysis failed: ${e.message}` : "Look analysis failed", 502);
  }
}
