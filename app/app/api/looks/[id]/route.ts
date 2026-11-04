import { itemBit, note } from "@/lib/brain/events";
import { fail, ok, run } from "@/lib/db";
import { getLook, listProducts } from "@/lib/shop/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_r: Request, ctx: RouteContext<"/api/looks/[id]">) {
  const { id } = await ctx.params;
  const look = getLook(id);
  return look ? ok({ ...look, products: listProducts("WHERE look_id = ?", id) }) : fail("not found", 404);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/looks/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  if (Array.isArray(b.pieces)) {
    const before = getLook(id)?.pieces ?? [];
    run("UPDATE looks SET pieces = ?, analysed = 1 WHERE id = ?", JSON.stringify(b.pieces), id);
    for (const p of b.pieces as { id: string; name: string; want?: string }[]) {
      const was = before.find((x) => x.id === p.id)?.want ?? "tobuy";
      if ((p.want ?? "tobuy") !== was) note("piece.want", { name: p.name, want: p.want });
    }
  }
  if ("note" in b) run("UPDATE looks SET note = ? WHERE id = ?", String(b.note), id);
  if ("sourceUrl" in b) run("UPDATE looks SET source_url = ? WHERE id = ?", String(b.sourceUrl), id);
  const look = getLook(id);
  return look ? ok(look) : fail("not found", 404);
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/looks/[id]">) {
  const { id } = await ctx.params;
  // saved (wishlist) products survive the look they came from
  run("UPDATE products SET look_id = NULL, piece_id = NULL WHERE look_id = ? AND saved = 1", id);
  run("DELETE FROM products WHERE look_id = ? AND saved = 0", id);
  run("DELETE FROM looks WHERE id = ?", id);
  return ok({ ok: true });
}
