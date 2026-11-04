import { all, fail, ok, run, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const boards = all("SELECT * FROM boards ORDER BY created_at DESC");
  return ok(
    boards.map((b) => {
      const entries = all("SELECT kind, ref_id, image FROM board_entries WHERE board_id = ? ORDER BY created_at DESC, rowid DESC", b.id);
      const previews: string[] = [];
      for (const e of entries) {
        if (previews.length >= 4) break;
        if (e.kind === "image" && e.image) previews.push(e.image);
        else if (e.kind === "item") {
          const it = all("SELECT image FROM items WHERE id = ?", e.ref_id)[0];
          if (it) previews.push(it.image);
        } else if (e.kind === "outfit") {
          const it = all("SELECT i.image FROM outfit_items oi JOIN items i ON i.id = oi.item_id WHERE oi.outfit_id = ? ORDER BY oi.pos LIMIT 1", e.ref_id)[0];
          if (it) previews.push(it.image);
        }
      }
      return { id: b.id as string, name: b.name as string, count: entries.length, previews };
    }),
  );
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim();
  if (!name) return fail("name required");
  const id = uid();
  run("INSERT INTO boards (id,name) VALUES (?,?)", id, name);
  return ok({ id, name, count: 0, previews: [] }, 201);
}
