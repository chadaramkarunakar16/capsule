import { all } from "./db";

export function loadOutfits(where = "", ...p: unknown[]) {
  const rows = all(`SELECT * FROM outfits ${where} ORDER BY created_at DESC`, ...p);
  return rows.map((o) => ({
    id: o.id as string,
    name: o.name as string,
    occasion: o.occasion as string,
    createdAt: o.created_at as string,
    itemIds: all("SELECT item_id FROM outfit_items WHERE outfit_id = ? ORDER BY pos", o.id).map((r) => r.item_id as string),
  }));
}

export function loadEntries(boardId: string) {
  return all("SELECT * FROM board_entries WHERE board_id = ? ORDER BY created_at DESC, rowid DESC", boardId).map((e) => ({
    id: e.id as string,
    boardId: e.board_id as string,
    kind: e.kind as "item" | "outfit" | "image",
    refId: (e.ref_id ?? null) as string | null,
    image: (e.image ?? null) as string | null,
    note: e.note as string,
    url: e.url as string,
  }));
}
