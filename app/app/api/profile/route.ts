import { fail, get, ok, run } from "@/lib/db";
import { EMPTY_PROFILE, normalizeProfile } from "@/lib/style/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const r = get("SELECT data, updated_at FROM profile WHERE id = 1");
  if (!r) return ok(EMPTY_PROFILE);
  try {
    return ok({ ...normalizeProfile(JSON.parse(r.data)), updatedAt: r.updated_at });
  } catch {
    return ok(EMPTY_PROFILE);
  }
}

// Replaces the whole profile. Only derived numbers and choices are stored — never the photos.
export async function PUT(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return fail("bad body");
  const p = normalizeProfile(b);
  run(
    "INSERT INTO profile (id,data,updated_at) VALUES (1,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    JSON.stringify(p),
  );
  return ok(p);
}
