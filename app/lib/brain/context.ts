// What every AI call is told about the person and how they use the app, so all features share one memory.
import { all, get } from "../db";
import { brainLearns } from "../settings";

export type Memory = { summary: string; likes: string[]; dislikes: string[]; rules: string[]; tagHints: string[] };

export function readMemory(): (Memory & { updatedAt: string; eventsSeen: number }) | null {
  try {
    const r = get("SELECT data, updated_at, events_seen FROM brain_memory WHERE id = 1");
    if (!r) return null;
    const m = JSON.parse(r.data) as Memory;
    return { summary: m.summary ?? "", likes: m.likes ?? [], dislikes: m.dislikes ?? [], rules: m.rules ?? [], tagHints: m.tagHints ?? [], updatedAt: r.updated_at, eventsSeen: r.events_seen ?? 0 };
  } catch { return null; }
}

const top = (xs: string[], n: number) => {
  const c = new Map<string, number>();
  for (const x of xs) if (x) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => (v > 1 ? `${k} x${v}` : k));
};

/** Recent times the person fixed what the AI got wrong, as plain sentences. */
export function corrections(limit = 8): string[] {
  try {
    return all("SELECT data FROM brain_events WHERE kind = 'item.corrected' ORDER BY at DESC, rowid DESC LIMIT ?", limit).map((r) => {
      const d = JSON.parse(r.data) as { name?: string; changes?: { field: string; from: unknown; to: unknown }[] };
      return `${d.name ?? "a piece"}: ${(d.changes ?? []).map((c) => `${c.field} "${c.from}" -> "${c.to}"`).join(", ")}`;
    });
  } catch { return []; }
}

/** The briefing block that goes in front of AI prompts. Empty when there is nothing worth saying. */
export function brainContext(feature: string): string {
  try {
    const lines: string[] = [];
    const items = all("SELECT category, color_name, formality, status, created_at FROM items WHERE status = 'active'");
    if (items.length) {
      const byCat = top(items.map((i) => i.category as string), 7);
      const colours = top(items.map((i) => String(i.color_name || "").toLowerCase()), 5);
      const never = get("SELECT COUNT(*) AS c FROM items i WHERE i.status = 'active' AND NOT EXISTS (SELECT 1 FROM wear_items wi JOIN wears w ON w.id = wi.wear_id WHERE wi.item_id = i.id AND w.planned = 0)")?.c ?? 0;
      lines.push(`- Closet: ${items.length} pieces (${byCat.join(", ")}). Common colours: ${colours.join(", ") || "n/a"}. Never worn: ${never}.`);
    }
    const wants = all("SELECT pieces FROM looks").flatMap((l) => { try { return JSON.parse(l.pieces) as { name: string; want?: string }[]; } catch { return []; } }).filter((p) => (p.want ?? "tobuy") === "tobuy");
    const nLooks = get("SELECT COUNT(*) AS c FROM looks")?.c ?? 0;
    if (nLooks) lines.push(`- Inspiration: ${nLooks} look${nLooks === 1 ? "" : "s"} saved${wants.length ? `; wants to buy: ${wants.slice(0, 6).map((p) => p.name).join(", ")}` : ""}.`);

    if (brainLearns()) {
      const fb = all("SELECT rating, tags FROM feedback ORDER BY created_at DESC LIMIT 60");
      if (fb.length) {
        const likes = fb.filter((f) => f.rating > 0).length;
        const tags = top(fb.flatMap((f) => { try { return JSON.parse(f.tags) as string[]; } catch { return []; } }), 4);
        lines.push(`- Feedback: ${likes} liked, ${fb.length - likes} passed on${tags.length ? `; complaints: ${tags.join(", ")}` : ""}.`);
      }
      const saved = all("SELECT data FROM brain_events WHERE kind = 'style.saved' ORDER BY at DESC LIMIT 8").map((r) => { try { return (JSON.parse(r.data) as { name?: string }).name ?? ""; } catch { return ""; } }).filter(Boolean);
      if (saved.length) lines.push(`- Saved grooming styles: ${[...new Set(saved)].join(", ")}.`);
      const worn = get("SELECT COUNT(*) AS c FROM wears WHERE planned = 0 AND date >= date('now','-30 day')")?.c ?? 0;
      if (worn) lines.push(`- Logged ${worn} outfit${worn === 1 ? "" : "s"} worn in the last 30 days.`);
      if (feature === "tag" || feature === "split") {
        const c = corrections(6);
        if (c.length) lines.push(`- The person corrected earlier AI labels; follow their way of naming and categorising: ${c.join(" | ")}`);
      }
      const m = readMemory();
      if (m) {
        if (m.summary) lines.push(`- Learned: ${m.summary}`);
        if (m.likes.length) lines.push(`- Likes: ${m.likes.join("; ")}`);
        if (m.dislikes.length) lines.push(`- Dislikes: ${m.dislikes.join("; ")}`);
        if (m.rules.length) lines.push(`- Rules for this person: ${m.rules.join("; ")}`);
        if ((feature === "tag" || feature === "split") && m.tagHints.length) lines.push(`- Naming hints: ${m.tagHints.join("; ")}`);
      }
    }
    return lines.length ? `APP MEMORY (what Capsule knows from how this person uses it; use it to personalise, do not recite it)\n${lines.join("\n")}` : "";
  } catch { return ""; }
}
