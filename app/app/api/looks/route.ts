import { all, fail, get, ok, run, uid } from "@/lib/db";
import { mapLook } from "@/lib/shop/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(all("SELECT * FROM looks ORDER BY created_at DESC").map(mapLook));
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.image !== "string" || !/^[\w.-]+$/.test(b.image)) return fail("image required");
  const id = uid();
  run("INSERT INTO looks (id,image,source_url,note) VALUES (?,?,?,?)", id, b.image, String(b.sourceUrl ?? ""), String(b.note ?? ""));
  return ok(mapLook(get("SELECT * FROM looks WHERE id = ?", id)!), 201);
}
