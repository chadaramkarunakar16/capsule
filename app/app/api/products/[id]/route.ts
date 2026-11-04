import { all, fail, get, ok, run } from "@/lib/db";
import { mapProduct } from "@/lib/shop/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_r: Request, ctx: RouteContext<"/api/products/[id]">) {
  const { id } = await ctx.params;
  const r = get("SELECT * FROM products WHERE id = ?", id);
  if (!r) return fail("not found", 404);
  return ok({ ...mapProduct(r), history: all("SELECT price, at FROM price_history WHERE product_id = ? ORDER BY at", id) });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/products/[id]">) {
  const { id } = await ctx.params;
  const r = get("SELECT * FROM products WHERE id = ?", id);
  if (!r) return fail("not found", 404);
  const b = await req.json().catch(() => ({}));
  if ("selected" in b) {
    if (b.selected && r.look_id && r.piece_id) run("UPDATE products SET selected = 0 WHERE look_id = ? AND piece_id = ?", r.look_id, r.piece_id);
    run("UPDATE products SET selected = ? WHERE id = ?", b.selected ? 1 : 0, id);
  }
  if ("saved" in b) run("UPDATE products SET saved = ? WHERE id = ?", b.saved ? 1 : 0, id);
  run("UPDATE products SET updated_at = datetime('now') WHERE id = ?", id);
  // a product that is neither chosen nor saved has no reason to stay
  run("DELETE FROM products WHERE id = ? AND selected = 0 AND saved = 0", id);
  const out = get("SELECT * FROM products WHERE id = ?", id);
  return ok(out ? mapProduct(out) : { removed: true });
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/products/[id]">) {
  const { id } = await ctx.params;
  run("DELETE FROM products WHERE id = ?", id);
  return ok({ ok: true });
}
