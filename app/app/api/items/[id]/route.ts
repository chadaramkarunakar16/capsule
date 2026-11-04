import fs from "node:fs";
import path from "node:path";
import { ITEM_SELECT, UPLOAD_DIR, fail, get, mapItem, ok, run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS: Record<string, string> = {
  name: "name",
  brand: "brand",
  category: "category",
  colorName: "color_name",
  colorHex: "color_hex",
  pattern: "pattern",
  fit: "fit",
  formality: "formality",
  season: "season",
  size: "size",
  price: "price",
  purchaseDate: "purchase_date",
  notes: "notes",
  status: "status",
  image: "image",
};

export async function GET(_r: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const r = get(`${ITEM_SELECT} WHERE i.id = ?`, id);
  return r ? ok(mapItem(r)) : fail("not found", 404);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(COLS)) {
    if (k in b) {
      sets.push(`${col} = ?`);
      vals.push(b[k] === "" && (k === "price" || k === "purchaseDate") ? null : b[k]);
    }
  }
  if ("attrs" in b) {
    sets.push("attrs = ?");
    vals.push(JSON.stringify(b.attrs ?? {}));
  }
  if (!sets.length) return fail("nothing to update");
  run(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  const r = get(`${ITEM_SELECT} WHERE i.id = ?`, id);
  return r ? ok(mapItem(r)) : fail("not found", 404);
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const r = get("SELECT image, original FROM items WHERE id = ?", id);
  if (!r) return fail("not found", 404);
  run("DELETE FROM items WHERE id = ?", id);
  for (const f of [r.image, r.original]) {
    if (!f) continue;
    const used = get(
      "SELECT 1 AS x FROM items WHERE image = ? OR original = ? UNION SELECT 1 FROM board_entries WHERE image = ?",
      f, f, f,
    );
    if (!used) fs.rmSync(path.join(UPLOAD_DIR, path.basename(f)), { force: true });
  }
  return ok({ ok: true });
}
