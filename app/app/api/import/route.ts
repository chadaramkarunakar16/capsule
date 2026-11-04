import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, all, db, fail, ok, run, tx } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLES = ["items", "outfits", "outfit_items", "wears", "wear_items", "boards", "board_entries"] as const;
const OPTIONAL = ["profile", "feedback", "looks", "products", "price_history", "capsules"] as const; // absent in exports made before Phase 2
const NAME = /^[\w.-]+$/;

// Replaces the whole library with the contents of an export file.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || b.app !== "capsule" || b.version !== 1) return fail("not a Capsule export file");
  for (const t of TABLES) if (!Array.isArray(b[t])) return fail(`export is missing "${t}"`);

  // write images first (validated names only)
  const images: Record<string, string> = b.images ?? {};
  for (const [name, uri] of Object.entries(images)) {
    if (!NAME.test(name)) continue;
    const m = /^data:[^;]+;base64,(.*)$/.exec(uri);
    if (m) fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[1], "base64"));
  }

  tx(() => {
    for (const t of [...TABLES].reverse()) run(`DELETE FROM ${t}`);
    run("DELETE FROM profile");
    run("DELETE FROM feedback");
    run("DELETE FROM price_history");
    run("DELETE FROM products");
    run("DELETE FROM looks");
    run("DELETE FROM capsules");
    for (const t of [...TABLES, ...OPTIONAL]) {
      if (!Array.isArray(b[t])) continue;
      const valid = new Set(all(`PRAGMA table_info(${t})`).map((c) => c.name as string));
      for (const row of b[t] as Record<string, unknown>[]) {
        const cols = Object.keys(row).filter((c) => valid.has(c));
        if (!cols.length) continue;
        db.prepare(`INSERT INTO ${t} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(
          ...(cols.map((c) => row[c]) as never[]),
        );
      }
    }
  });
  return ok({ ok: true, items: b.items.length, outfits: b.outfits.length, boards: b.boards.length });
}
