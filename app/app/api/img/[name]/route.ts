import fs from "node:fs";
import path from "node:path";
import { loadSharp } from "@/lib/sharp";
import { UPLOAD_DIR } from "@/lib/db";
import { DATA_DIR } from "@/lib/settings";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const WIDTHS = [160, 320, 640];
const CACHE = "public, max-age=31536000, immutable";

export async function GET(req: Request, ctx: RouteContext<"/api/img/[name]">) {
  const { name } = await ctx.params;
  if (!/^[\w.-]+$/.test(name)) return new Response("bad name", { status: 400 });
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
  const ext = path.extname(name).toLowerCase();

  const asked = Number(new URL(req.url).searchParams.get("w"));
  const w = WIDTHS.find((x) => x >= asked);
  // Animated GIFs and unknown widths are served as-is; everything else gets a cached WebP thumbnail.
  if (asked > 0 && w && ext !== ".gif") {
    const dir = path.join(DATA_DIR, "thumbs");
    const out = path.join(dir, `${name}.${w}.webp`);
    try {
      if (!fs.existsSync(out)) {
        fs.mkdirSync(dir, { recursive: true });
        await loadSharp()(file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
      }
      return new Response(fs.readFileSync(out), { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } });
    } catch {
      /* fall through to the original */
    }
  }
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": CACHE },
  });
}
