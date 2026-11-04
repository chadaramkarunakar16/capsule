import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, fail, ok, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 20 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function save(f: File, suffix = "") {
  const ext = EXT[f.type];
  if (!ext) throw new Error(`unsupported image type: ${f.type || "unknown"}`);
  if (f.size > MAX) throw new Error("image too large (20 MB max)");
  const name = `${uid()}${suffix}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
  return name;
}

// multipart: `cutout` (the image shown in the app) and optional `original`
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const cutout = form.get("cutout");
    const original = form.get("original");
    if (!(cutout instanceof File)) return fail("cutout file required");
    const image = await save(cutout);
    const orig = original instanceof File ? await save(original, "-orig") : null;
    return ok({ image, original: orig }, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "upload failed");
  }
}
