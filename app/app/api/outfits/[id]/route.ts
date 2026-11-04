import { fail, ok, run, tx } from "@/lib/db";
import { loadOutfits } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  tx(() => {
    if ("name" in b) run("UPDATE outfits SET name = ? WHERE id = ?", b.name, id);
    if ("occasion" in b) run("UPDATE outfits SET occasion = ? WHERE id = ?", b.occasion, id);
    if (Array.isArray(b.itemIds)) {
      run("DELETE FROM outfit_items WHERE outfit_id = ?", id);
      b.itemIds.forEach((iid: string, i: number) =>
        run("INSERT OR IGNORE INTO outfit_items (outfit_id,item_id,pos) VALUES (?,?,?)", id, iid, i),
      );
    }
  });
  const o = loadOutfits("WHERE id = ?", id)[0];
  return o ? ok(o) : fail("not found", 404);
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/outfits/[id]">) {
  const { id } = await ctx.params;
  run("DELETE FROM outfits WHERE id = ?", id);
  return ok({ ok: true });
}
