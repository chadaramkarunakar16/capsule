import { all, fail, ok, run, uid } from "@/lib/db";
import { getCapsule, mapCapsule } from "@/lib/capsules-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(all("SELECT * FROM capsules ORDER BY created_at DESC").map(mapCapsule));
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !String(b.name ?? "").trim() || !Array.isArray(b.itemIds)) return fail("name and itemIds required");
  const id = uid();
  run(
    "INSERT INTO capsules (id,kind,name,config,item_ids,days,packed) VALUES (?,?,?,?,?,?,?)",
    id, b.kind === "trip" ? "trip" : "capsule", String(b.name).trim(), JSON.stringify(b.config ?? {}), JSON.stringify(b.itemIds), JSON.stringify(b.days ?? []), JSON.stringify(b.packed ?? {}),
  );
  return ok(getCapsule(id), 201);
}
