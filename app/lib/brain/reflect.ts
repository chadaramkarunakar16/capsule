// The brain tidies its own notes: it reads what happened since last time and updates a short portrait of the person's taste
// and a few rules to follow. That portrait is then part of every AI call, so every feature gets better together.
import { all, get, run } from "../db";
import { aiReady, askJSON } from "../ai";
import { brainLearns } from "../settings";
import { readMemory, type Memory } from "./context";

const EVERY = 12;          // new events before the notes are refreshed
const COOLDOWN_MS = 20 * 60 * 1000;
let running = false;
let lastRun = 0;

export const totalEvents = () => (get("SELECT COUNT(*) AS c FROM brain_events")?.c ?? 0) as number;

const list = (v: unknown, n: number, len = 140) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim().slice(0, len)).filter(Boolean).slice(0, n);

function digest(limit: number) {
  return all("SELECT kind, data, at FROM brain_events ORDER BY at DESC, rowid DESC LIMIT ?", limit)
    .reverse()
    .map((r) => `${String(r.at).slice(0, 10)} ${r.kind}: ${String(r.data).slice(0, 260)}`)
    .join("\n");
}

/** Refreshes the learned notes if enough has happened (or when forced). Safe to call often; does nothing without an AI key. */
export async function maybeReflect(force = false): Promise<Memory | null> {
  if (!brainLearns() || !aiReady() || running) return null;
  const seen = readMemory()?.eventsSeen ?? 0;
  const now = totalEvents();
  if (!force && (now - seen < EVERY || Date.now() - lastRun < COOLDOWN_MS)) return null;
  if (!now) return null;
  running = true;
  try {
    const prev = readMemory();
    const prompt = [
      "You keep a private style memory for one person using a wardrobe and styling app. Update it from their latest activity.",
      "Only state what the activity supports. Prefer patterns over single events. Never include personal identifiers. If there is little to learn, keep the previous notes.",
      prev ? `PREVIOUS MEMORY: ${JSON.stringify({ summary: prev.summary, likes: prev.likes, dislikes: prev.dislikes, rules: prev.rules, tagHints: prev.tagHints })}` : "PREVIOUS MEMORY: none yet",
      "", "RECENT ACTIVITY (oldest first):", digest(70), "",
      'Reply with ONE JSON object: {"summary":"at most 70 words describing their taste and habits in plain language","likes":["up to 8 short items"],"dislikes":["up to 8 short items"],"rules":["up to 6 short, actionable rules for an assistant styling this person"],"tagHints":["up to 6 hints on how they name or categorise pieces, from their corrections"]}',
    ].join("\n");
    const j = await askJSON("brain", { prompt, maxTokens: 600, brain: false });
    const mem: Memory = { summary: String(j.summary ?? "").slice(0, 600), likes: list(j.likes, 8), dislikes: list(j.dislikes, 8), rules: list(j.rules, 6, 200), tagHints: list(j.tagHints, 6, 200) };
    run("INSERT INTO brain_memory (id,data,events_seen,updated_at) VALUES (1,?,?,datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, events_seen = excluded.events_seen, updated_at = excluded.updated_at", JSON.stringify(mem), now);
    lastRun = Date.now();
    return mem;
  } finally {
    running = false;
  }
}
