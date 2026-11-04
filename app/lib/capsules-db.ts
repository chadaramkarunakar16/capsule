import { get, type Row } from "./db";
import type { SavedCapsule } from "./types";

export function mapCapsule(r: Row): SavedCapsule {
  const j = <T,>(s: string, d: T): T => { try { return JSON.parse(s); } catch { return d; } };
  return { id: r.id, kind: r.kind, name: r.name, config: j(r.config, {} as SavedCapsule["config"]), itemIds: j(r.item_ids, []), days: j(r.days, []), packed: j(r.packed, {}), createdAt: r.created_at };
}
export const getCapsule = (id: string) => { const r = get("SELECT * FROM capsules WHERE id = ?", id); return r ? mapCapsule(r) : null; };
