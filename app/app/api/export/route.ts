import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, all } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

// One self-contained JSON file: all tables + every referenced image as a data URI.
export async function GET() {
  const tables = {
    items: all("SELECT * FROM items"),
    outfits: all("SELECT * FROM outfits"),
    outfit_items: all("SELECT * FROM outfit_items"),
    wears: all("SELECT * FROM wears"),
    wear_items: all("SELECT * FROM wear_items"),
    boards: all("SELECT * FROM boards"),
    board_entries: all("SELECT * FROM board_entries"),
    profile: all("SELECT * FROM profile"),
    feedback: all("SELECT * FROM feedback"),
    looks: all("SELECT * FROM looks"),
    capsules: all("SELECT * FROM capsules"),
    products: all("SELECT * FROM products"),
    price_history: all("SELECT * FROM price_history"),
    brain_events: all("SELECT * FROM brain_events"),
    brain_memory: all("SELECT * FROM brain_memory"),
  };
  const names = new Set<string>();
  for (const i of tables.items) {
    if (i.image) names.add(i.image);
    if (i.original) names.add(i.original);
  }
  for (const e of tables.board_entries) if (e.image) names.add(e.image);
  for (const l of tables.looks) if (l.image) names.add(l.image);
  // pictures kept on the profile (your photo, face photo, AI image)
  for (const p of tables.profile) {
    try { const a = JSON.parse(p.data).avatar ?? {}; for (const k of ["photo", "facePhoto", "aiImage"]) if (typeof a[k] === "string") names.add(a[k]); } catch { /* skip */ }
  }
  const images: Record<string, string> = {};
  for (const n of names) {
    const f = path.join(UPLOAD_DIR, path.basename(n));
    if (!fs.existsSync(f)) continue;
    const ext = path.extname(n).slice(1).toLowerCase();
    images[n] = `data:${MIME[ext] ?? "application/octet-stream"};base64,${fs.readFileSync(f).toString("base64")}`;
  }
  const body = JSON.stringify({ app: "capsule", version: 1, exportedAt: new Date().toISOString(), ...tables, images });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="capsule-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
