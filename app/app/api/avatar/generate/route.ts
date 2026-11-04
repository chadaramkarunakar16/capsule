import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, get, ok, uid } from "@/lib/db";
import { TRYON_MODELS, geminiImage, quality, type Img } from "@/lib/ai";
import { avatarPrompt } from "@/lib/avatar/prompt";
import { normalizeProfile } from "@/lib/style/profile";
import { geminiKey } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NAME = /^[\w.-]+$/;
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function load(name: unknown): Img | null {
  if (typeof name !== "string" || !NAME.test(name)) return null;
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return null;
  return { data: new Uint8Array(fs.readFileSync(file)), mime: MIME[path.extname(name).toLowerCase()] ?? "image/jpeg" };
}

/** body: { photo?: imageName, facePhoto?: imageName } - makes an AI image of the person from their saved photos. */
export async function POST(req: Request) {
  if (!geminiKey()) return ok({ available: false });
  const b = await req.json().catch(() => null);
  const body = load(b?.photo), face = load(b?.facePhoto);
  if (!body && !face) return fail("Add a photo first");
  const row = get("SELECT data FROM profile WHERE id = 1");
  let profile = normalizeProfile(null);
  try { if (row) profile = normalizeProfile(JSON.parse(row.data)); } catch { /* use defaults */ }
  try {
    const refs = [body, face].filter((x): x is Img => !!x);
    const out = await geminiImage(TRYON_MODELS[quality()].model, avatarPrompt(profile, { body: !!body, face: !!face }), refs);
    const ext = out.mime.includes("png") ? "png" : out.mime.includes("webp") ? "webp" : "jpg";
    const name = `${uid()}-avatar.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(out.data));
    return ok({ available: true, image: name });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn\u2019t create the image", 502);
  }
}
