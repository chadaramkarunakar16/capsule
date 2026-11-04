import { ok, run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: RouteContext<"/api/boards/[id]/entries/[entryId]">) {
  const { entryId } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  if ("note" in b) run("UPDATE board_entries SET note = ? WHERE id = ?", String(b.note), entryId);
  if ("url" in b) run("UPDATE board_entries SET url = ? WHERE id = ?", String(b.url), entryId);
  return ok({ ok: true });
}

export async function DELETE(_r: Request, ctx: RouteContext<"/api/boards/[id]/entries/[entryId]">) {
  const { entryId } = await ctx.params;
  run("DELETE FROM board_entries WHERE id = ?", entryId);
  return ok({ ok: true });
}
