import { note } from "@/lib/brain/events";
import { BEARDS, FRAMES, HAIRSTYLES } from "@/lib/grooming/catalog";
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
  try {
    const old = get("SELECT data FROM profile WHERE id = 1");
    const before = normalizeProfile(old ? JSON.parse(old.data) : null);
    const nameOf = (kind: string, id: string) => (kind === "hair" ? HAIRSTYLES : kind === "beard" ? BEARDS : FRAMES).find((x) => x.id === id)?.name ?? id;
    const key = (s: { kind: string; id: string }) => `${s.kind}:${s.id}`;
    for (const s of p.grooming.saved) if (!before.grooming.saved.some((o) => key(o) === key(s))) note("style.saved", { kind: s.kind, name: nameOf(s.kind, s.id) });
    for (const s of before.grooming.saved) if (!p.grooming.saved.some((o) => key(o) === key(s))) note("style.unsaved", { kind: s.kind, name: nameOf(s.kind, s.id) });
    if (p.avatar.look !== before.avatar.look) note("avatar.look", { look: p.avatar.look });
    if (p.face.overridden && p.face.shape && p.face.auto && p.face.shape !== p.face.auto.shape) note("face.corrected", { from: p.face.auto.shape, to: p.face.shape });
    if (p.color.overridden && p.color.season && p.color.auto && p.color.season !== p.color.auto.key) note("season.corrected", { from: p.color.auto.key, to: p.color.season });
  } catch { /* learning never blocks saving */ }
  run(
    "INSERT INTO profile (id,data,updated_at) VALUES (1,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    JSON.stringify(p),
  );
  return ok(p);
}
