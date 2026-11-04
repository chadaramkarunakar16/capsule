import { fail, ok, run, tx, uid } from "@/lib/db";
import { loadOutfits } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(loadOutfits());
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.itemIds) || b.itemIds.length < 1) return fail("itemIds required");
  const id = uid();
  tx(() => {
    run("INSERT INTO outfits (id,name,occasion) VALUES (?,?,?)", id, b.name || "Untitled look", b.occasion ?? "");
    b.itemIds.forEach((iid: string, i: number) =>
      run("INSERT OR IGNORE INTO outfit_items (outfit_id,item_id,pos) VALUES (?,?,?)", id, iid, i),
    );
  });
  return ok(loadOutfits("WHERE id = ?", id)[0], 201);
}
