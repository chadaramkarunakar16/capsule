// The AI brain's raw material: small, factual records of what the person does in the app (what they confirm, correct,
// like, wear, save and ask). They stay in this app's database. Switch learning off in Me → AI brain and nothing is recorded.
import { run, uid } from "../db";
import { brainLearns } from "../settings";

export type Data = Record<string, unknown>;

export function note(kind: string, data: Data) {
  if (!brainLearns()) return;
  try {
    run("INSERT INTO brain_events (id,kind,data) VALUES (?,?,?)", uid(), kind, JSON.stringify(data).slice(0, 1500));
    run("DELETE FROM brain_events WHERE id NOT IN (SELECT id FROM brain_events ORDER BY at DESC, rowid DESC LIMIT 3000)");
    // let the brain tidy its notes when enough has happened (never blocks the request that caused it)
    import("./reflect").then((m) => m.maybeReflect()).catch(() => {});
  } catch { /* learning is best-effort and must never break the app */ }
}

/** Short description of a piece for the log: enough to learn from, nothing more. */
export const itemBit = (r: { name?: string; category?: string; color_name?: string; colorName?: string; fit?: string }) =>
  [r.name || r.category, r.category && r.name ? r.category : null, r.color_name || r.colorName, r.fit].filter(Boolean).join(", ");
