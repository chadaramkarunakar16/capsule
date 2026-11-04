import { fail, get, ok, run, uid } from "@/lib/db";
import { loadEntries } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/boards/[id]/entries">) {
  const { id } = await ctx.params;
  if (!get("SELECT 1 AS x FROM boards WHERE id = ?", id)) return fail("board not found", 404);
  const b = await req.json().catch(() => null);
  if (!b || !["item", "outfit", "image"].includes(b.kind)) return fail("kind must be item|outfit|image");
  if (b.kind !== "image" && !b.refId) return fail("refId required");
  if (b.kind === "image" && !b.image) return fail("image required");
  if (b.kind !== "image") {
    const dup = get("SELECT 1 AS x FROM board_entries WHERE board_id = ? AND kind = ? AND ref_id = ?", id, b.kind, b.refId);
    if (dup) return ok({ duplicate: true });
  }
  const eid = uid();
  run(
    "INSERT INTO board_entries (id,board_id,kind,ref_id,image,note,url) VALUES (?,?,?,?,?,?,?)",
    eid, id, b.kind, b.refId ?? null, b.image ?? null, b.note ?? "", b.url ?? "",
  );
  return ok(loadEntries(id).find((e) => e.id === eid), 201);
}
