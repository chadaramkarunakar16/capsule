import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, UPLOAD_DIR, db, fail, ok, tx } from "@/lib/db";
import { readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES = ["price_history", "products", "looks", "capsules", "feedback", "board_entries", "boards", "wear_items", "wears", "outfit_items", "outfits", "items", "profile"];

function emptyDir(dir: string) {
  let n = 0;
  try { for (const f of fs.readdirSync(dir)) { fs.rmSync(path.join(dir, f), { force: true, recursive: true }); n++; } } catch { /* missing */ }
  return n;
}

/** body: { confirm: "DELETE EVERYTHING", keys?: boolean, models?: boolean } — removes your library and every photo. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== "DELETE EVERYTHING") return fail("Type DELETE EVERYTHING to confirm");
  tx(() => { for (const t of TABLES) db.exec(`DELETE FROM ${t}`); });
  db.exec("VACUUM");
  const removed = { photos: emptyDir(UPLOAD_DIR), thumbs: emptyDir(path.join(DATA_DIR, "thumbs")), models: b.models ? emptyDir(path.join(DATA_DIR, "models")) : 0 };
  if (b.keys) { const s = readSettings(); delete s.anthropicKey; delete s.geminiKey; delete s.serpApiKey; delete s.fashnKey; writeSettings(s); }
  return ok({ ok: true, removed });
}
