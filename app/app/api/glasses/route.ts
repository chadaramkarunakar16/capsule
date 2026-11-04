import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok, uid } from "@/lib/db";
import { aiReady, makeImage } from "@/lib/ai";
import { FRAMES } from "@/lib/grooming/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/;

/** body: { photo: dataURI, frame: frameId, colour: string } — the person's photo with those glasses added. The photo is not stored. */
export async function POST(req: Request) {
  if (!aiReady()) return ok({ available: false });
  const b = await req.json().catch(() => null);
  const m = typeof b?.photo === "string" ? DATA_URI.exec(b.photo) : null;
  const frame = FRAMES.find((f) => f.id === b?.frame);
  if (!m || !frame) return fail("a photo and a frame style are required");
  if (b.photo.length > 8_000_000) return fail("that photo is too large");
  const colour = String(b.colour || "black").replace(/[^\w #-]/g, "").slice(0, 30);
  const prompt = `Edit this photo of a person: add a pair of ${frame.name.toLowerCase()} eyeglasses in ${colour}, sitting naturally on the nose and ears at the correct scale for the face. If they already wear glasses, replace them. Keep the face, expression, skin, hair, clothing, pose, background and lighting exactly the same; only the glasses change. Output only the edited photo.`;
  try {
    const out = await makeImage("edit", prompt, [{ data: new Uint8Array(Buffer.from(m[2], "base64")), mime: m[1] }], { aspect: "portrait" });
    const ext = out.mime.includes("png") ? "png" : out.mime.includes("webp") ? "webp" : "jpg";
    const name = `${uid()}-glasses.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(out.data));
    return ok({ available: true, image: name });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t add the glasses", 502);
  }
}
