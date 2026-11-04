// Pictures for the browser engine: original, or a resized WebP made with OffscreenCanvas and cached in the files table.
import { Buffer } from "buffer";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, DATA_DIR } from "@/lib/db";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const WIDTHS = [160, 320, 640];

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[\w.-]+$/.test(name)) return new Response("bad name", { status: 400 });
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
  const ext = path.extname(name).toLowerCase();
  const asked = Number(new URL(req.url).searchParams.get("w"));
  const w = WIDTHS.find((x) => x >= asked);
  if (asked > 0 && w && ext !== ".gif") {
    const out = path.join(DATA_DIR, "thumbs", `${name}.${w}.webp`);
    try {
      if (!fs.existsSync(out)) {
        const bmp = await createImageBitmap(new Blob([new Uint8Array(fs.readFileSync(file) as Buffer)], { type: TYPES[ext] }), { imageOrientation: "from-image" });
        const scale = Math.min(1, w / bmp.width);
        const cv = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)));
        cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
        const blob = await cv.convertToBlob({ type: "image/webp", quality: 0.78 });
        fs.writeFileSync(out, new Uint8Array(await blob.arrayBuffer()));
      }
      return new Response(new Uint8Array(fs.readFileSync(out) as Buffer), { headers: { "Content-Type": "image/webp" } });
    } catch { /* fall through to the original */ }
  }
  return new Response(new Uint8Array(fs.readFileSync(file) as Buffer), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream" } });
}
