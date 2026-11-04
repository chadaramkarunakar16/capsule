import { ok, run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Confirm a planned look as worn (or move its date).
export async function PATCH(req: Request, ctx: RouteContext<"/api/wears/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  if ("planned" in b) run("UPDATE wears SET planned = ? WHERE id = ?", b.planned ? 1 : 0, id);
  if (typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) run("UPDATE wears SET date = ? WHERE id = ?", b.date, id);
  return ok({ ok: true });
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/wears/[id]">) {
  const { id } = await ctx.params;
  run("DELETE FROM wears WHERE id = ?", id);
  return ok({ ok: true });
}
