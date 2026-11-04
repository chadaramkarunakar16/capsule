import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, run, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

// Web Share Target: "Share → Capsule" from Instagram / Pinterest / Photos (installed PWA or Android app).
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const f = form?.get("image");
  const link = String(form?.get("url") ?? form?.get("text") ?? "").match(/https?:\/\/\S+/)?.[0] ?? "";
  const origin = new URL(req.url).origin;
  if (f instanceof File && EXT[f.type] && f.size < 20 * 1024 * 1024) {
    const name = `${uid()}.${EXT[f.type]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
    const id = uid();
    run("INSERT INTO looks (id,image,source_url,note) VALUES (?,?,?,?)", id, name, link, String(form?.get("title") ?? ""));
    return Response.redirect(`${origin}/?look=${id}`, 303);
  }
  // a link with no image: open the app so the user can paste or upload a screenshot
  return Response.redirect(`${origin}/?shared=${encodeURIComponent(link)}`, 303);
}
