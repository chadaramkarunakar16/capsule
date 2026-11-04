import { itemBit, note } from "@/lib/brain/events";
import { all, fail, get, ok, run, tx, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function load(where = "", ...p: unknown[]) {
  return all(`SELECT * FROM wears ${where} ORDER BY date DESC`, ...p).map((w) => ({
    id: w.id as string,
    date: w.date as string,
    outfitId: (w.outfit_id ?? null) as string | null,
    note: w.note as string,
    planned: !!w.planned,
    itemIds: all("SELECT item_id FROM wear_items WHERE wear_id = ?", w.id).map((r) => r.item_id as string),
  }));
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (from && to) return ok(load("WHERE date >= ? AND date <= ?", from, to));
  return ok(load());
}

// Log a wear: either an outfitId (items copied from it) or an explicit itemIds list.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) return fail("date (YYYY-MM-DD) required");
  let itemIds: string[] = Array.isArray(b.itemIds) ? b.itemIds : [];
  if (b.outfitId) {
    if (!get("SELECT 1 AS x FROM outfits WHERE id = ?", b.outfitId)) return fail("outfit not found", 404);
    itemIds = all("SELECT item_id FROM outfit_items WHERE outfit_id = ? ORDER BY pos", b.outfitId).map((r) => r.item_id as string);
  }
  if (!itemIds.length) return fail("no items to log");
  const id = uid();
  tx(() => {
    run("INSERT INTO wears (id,date,outfit_id,note,planned) VALUES (?,?,?,?,?)", id, b.date, b.outfitId ?? null, b.note ?? "", b.planned ? 1 : 0);
    for (const iid of itemIds) run("INSERT OR IGNORE INTO wear_items (wear_id,item_id) VALUES (?,?)", id, iid);
  });
  note(b.planned ? "wear.planned" : "wear", { pieces: all(`SELECT name, category, color_name, fit FROM items WHERE id IN (${itemIds.map(() => "?").join(",")})`, ...itemIds).map((r) => itemBit(r)), date: b.date });
  return ok(load("WHERE id = ?", id)[0], 201);
}
