import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MediaPipe model files. Fetched once from Google's public model bucket, then served from disk,
// so the browser never needs cross-origin access and the app works offline afterwards.
const MODELS: Record<string, string> = {
  "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

export async function GET(_r: Request, ctx: RouteContext<"/api/model/[name]">) {
  const { name } = await ctx.params;
  const url = MODELS[name];
  if (!url) return new Response("unknown model", { status: 404 });
  const dir = path.join(DATA_DIR, "models");
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    const r = await fetch(url);
    if (!r.ok) return new Response(`model download failed (${r.status})`, { status: 502 });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500_000) return new Response("model download looked wrong", { status: 502 });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file + ".part", buf);
    fs.renameSync(file + ".part", file);
  }
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
