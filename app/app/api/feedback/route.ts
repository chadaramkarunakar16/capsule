import { all, fail, ok, run, uid } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(
    all("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 500").map((r) => ({
      id: r.id as string,
      itemIds: JSON.parse(r.item_ids) as string[],
      rating: r.rating as 1 | -1,
      tags: JSON.parse(r.tags) as string[],
      context: r.context as string,
      createdAt: r.created_at as string,
    })),
  );
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.itemIds) || !b.itemIds.length || ![1, -1].includes(b.rating)) return fail("itemIds and rating (1 | -1) required");
  const id = uid();
  run(
    "INSERT INTO feedback (id,item_ids,rating,tags,context) VALUES (?,?,?,?,?)",
    id, JSON.stringify(b.itemIds), b.rating, JSON.stringify(Array.isArray(b.tags) ? b.tags : []), String(b.context ?? ""),
  );
  return ok({ id }, 201);
}

export async function DELETE() {
  run("DELETE FROM feedback");
  return ok({ ok: true });
}
