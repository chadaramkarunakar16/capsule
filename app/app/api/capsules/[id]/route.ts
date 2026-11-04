import { fail, ok, run } from "@/lib/db";
import { getCapsule } from "@/lib/capsules-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_r: Request, ctx: RouteContext<"/api/capsules/[id]">) {
  const { id } = await ctx.params;
  const c = getCapsule(id);
  return c ? ok(c) : fail("not found", 404);
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/capsules/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  if (typeof b.name === "string" && b.name.trim()) run("UPDATE capsules SET name = ? WHERE id = ?", b.name.trim(), id);
  if (b.config) run("UPDATE capsules SET config = ? WHERE id = ?", JSON.stringify(b.config), id);
  if (Array.isArray(b.itemIds)) run("UPDATE capsules SET item_ids = ? WHERE id = ?", JSON.stringify(b.itemIds), id);
  if (Array.isArray(b.days)) run("UPDATE capsules SET days = ? WHERE id = ?", JSON.stringify(b.days), id);
  if (b.packed && typeof b.packed === "object") run("UPDATE capsules SET packed = ? WHERE id = ?", JSON.stringify(b.packed), id);
  const c = getCapsule(id);
  return c ? ok(c) : fail("not found", 404);
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/capsules/[id]">) {
  const { id } = await ctx.params;
  run("DELETE FROM capsules WHERE id = ?", id);
  return ok({ ok: true });
}
