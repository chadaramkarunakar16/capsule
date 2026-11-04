import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, UPLOAD_DIR, get, ok } from "@/lib/db";
import { aiReady } from "@/lib/ai";
import { fashnKey, serpKey } from "@/lib/settings";
import { hasPin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dirStats(dir: string) {
  let files = 0, bytes = 0;
  try { for (const f of fs.readdirSync(dir)) { const s = fs.statSync(path.join(dir, f)); if (s.isFile()) { files++; bytes += s.size; } } } catch { /* missing */ }
  return { files, bytes };
}
const n = (table: string) => (get(`SELECT COUNT(*) AS c FROM ${table}`)?.c ?? 0) as number;

// What Capsule holds, in plain numbers. No contents, no key values.
export async function GET() {
  return ok({
    rows: { items: n("items"), outfits: n("outfits"), wears: n("wears"), boards: n("boards"), looks: n("looks"), products: n("products"), capsules: n("capsules"), feedback: n("feedback") },
    profile: !!get("SELECT 1 AS x FROM profile WHERE id = 1"),
    photos: dirStats(UPLOAD_DIR),
    thumbs: dirStats(path.join(DATA_DIR, "thumbs")),
    models: dirStats(path.join(DATA_DIR, "models")),
    keys: { anthropic: aiReady(), serpapi: !!serpKey(), fashn: !!fashnKey() },
    pin: hasPin(),
  });
}
