import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok, uid } from "@/lib/db";
import { aiReady, makeImage } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const PROMPT = "This is a photo of a clothing item (it may be on a hanger, a floor, a bed or a person). Output the same single garment, cleanly isolated on a plain, flat, light warm-grey (#f1eee9) background, centred, evenly lit and filling most of the frame. Keep its exact colour, pattern, fabric texture, shape and details. Remove hangers, hands, people, other objects, shadows and the original background. Do not add or change anything on the garment. Output only the image.";

/** body: { image: uploadedName } — an AI "clean cut-out" of one garment on a plain background. Optional, about 4¢ per picture. */
export async function POST(req: Request) {
  if (!aiReady()) return ok({ available: false });
  const b = await req.json().catch(() => null);
  const name = b?.image;
  if (typeof name !== "string" || !/^[\w.-]+$/.test(name)) return fail("image required");
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return fail("image not found", 404);
  try {
    const out = await makeImage("edit", PROMPT, [{ data: new Uint8Array(fs.readFileSync(file)), mime: MIME[path.extname(name).toLowerCase()] ?? "image/jpeg" }], { aspect: "square" });
    const ext = out.mime.includes("png") ? "png" : out.mime.includes("webp") ? "webp" : "jpg";
    const saved = `${uid()}-cut.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, saved), Buffer.from(out.data));
    return ok({ available: true, image: saved });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t make the cut-out", 502);
  }
}
