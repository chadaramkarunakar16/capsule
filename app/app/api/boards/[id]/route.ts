import { fail, get, ok, run } from "@/lib/db";
import { loadEntries } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_r: Request, ctx: RouteContext<"/api/boards/[id]">) {
  const { id } = await ctx.params;
  const b = get("SELECT * FROM boards WHERE id = ?", id);
  if (!b) return fail("not found", 404);
  return ok({ id: b.id, name: b.name, entries: loadEntries(id) });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/boards/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (!name) return fail("name required");
  run("UPDATE boards SET name = ? WHERE id = ?", name, id);
  return ok({ ok: true });
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/boards/[id]">) {
  const { id } = await ctx.params;
  run("DELETE FROM boards WHERE id = ?", id);
  return ok({ ok: true });
}
