import { all, fail, get, ok, run } from "@/lib/db";
import { aiReady } from "@/lib/ai";
import { corrections, readMemory } from "@/lib/brain/context";
import { maybeReflect, totalEvents } from "@/lib/brain/reflect";
import { brainLearns, readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function state() {
  const m = readMemory();
  const byKind: Record<string, number> = {};
  for (const r of all("SELECT kind, COUNT(*) AS c FROM brain_events GROUP BY kind")) byKind[r.kind as string] = r.c as number;
  const total = totalEvents();
  return { enabled: brainLearns(), aiReady: aiReady(), memory: m, events: total, newSince: Math.max(0, total - (m?.eventsSeen ?? 0)), byKind, corrections: corrections(6), since: get("SELECT MIN(at) AS a FROM brain_events")?.a ?? null };
}

export async function GET() {
  return ok(state());
}

/** body: { action: "reflect" } refresh the notes now · { action: "forget" } erase what the brain learned · { action: "toggle", enabled } */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad body");
  if (b.action === "toggle") {
    const s = readSettings();
    s.brainLearn = !!b.enabled;
    writeSettings(s);
  } else if (b.action === "forget") {
    run("DELETE FROM brain_events");
    run("DELETE FROM brain_memory");
  } else if (b.action === "reflect") {
    if (!aiReady()) return fail("Add an AI key in Me → AI first.");
    try { await maybeReflect(true); } catch (e) { return fail(e instanceof Error ? e.message : "Couldn’t update the notes", 502); }
  } else return fail("unknown action");
  return ok(state());
}
