// Pieces of the data layer shared by the Node (local) and in-browser engines.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Tops',
  color_name TEXT NOT NULL DEFAULT '',
  color_hex TEXT NOT NULL DEFAULT '#cccccc',
  pattern TEXT NOT NULL DEFAULT 'solid',
  fit TEXT NOT NULL DEFAULT '',
  formality INTEGER NOT NULL DEFAULT 1,
  season TEXT NOT NULL DEFAULT 'all',
  size TEXT NOT NULL DEFAULT '',
  price REAL,
  purchase_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  attrs TEXT NOT NULL DEFAULT '{}',
  image TEXT NOT NULL,
  original TEXT,
  status TEXT NOT NULL DEFAULT 'active',      -- 'draft' = awaiting review
  ai_tagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outfits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  occasion TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS outfit_items (
  outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (outfit_id, item_id)
);
CREATE TABLE IF NOT EXISTS wears (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  outfit_id TEXT REFERENCES outfits(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS wear_items (
  wear_id TEXT NOT NULL REFERENCES wears(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (wear_id, item_id)
);
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS board_entries (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                          -- 'item' | 'outfit' | 'image'
  ref_id TEXT,
  image TEXT,
  note TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  item_ids TEXT NOT NULL,                      -- JSON array
  rating INTEGER NOT NULL,                     -- 1 like, -1 dislike
  tags TEXT NOT NULL DEFAULT '[]',
  context TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS looks (
  id TEXT PRIMARY KEY,
  image TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  pieces TEXT NOT NULL DEFAULT '[]',
  analysed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  look_id TEXT REFERENCES looks(id) ON DELETE CASCADE,
  piece_id TEXT,
  title TEXT NOT NULL,
  merchant TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  price REAL,
  old_price REAL,
  currency TEXT NOT NULL DEFAULT '',
  rating REAL,
  reviews INTEGER,
  delivery TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'pasted',
  trust TEXT NOT NULL DEFAULT '{}',
  selected INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  first_price REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS price_history (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_look ON products(look_id);
CREATE TABLE IF NOT EXISTS capsules (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'capsule',        -- 'capsule' | 'trip'
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  item_ids TEXT NOT NULL DEFAULT '[]',
  days TEXT NOT NULL DEFAULT '[]',
  packed TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS brain_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_brain_at ON brain_events(at);
CREATE TABLE IF NOT EXISTS brain_memory (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  events_seen INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wears_date ON wears(date);
CREATE INDEX IF NOT EXISTS idx_entries_board ON board_entries(board_id);
`;


/** Additive migrations for libraries created before Phase 2B. */
export function migrate(d: { exec(sql: string): unknown; prepare(sql: string): { all(...p: never[]): unknown[] } }) {
  const wearCols = (d.prepare("PRAGMA table_info(wears)").all() as { name: string }[]).map((c) => c.name);
  if (!wearCols.includes("planned")) d.exec("ALTER TABLE wears ADD COLUMN planned INTEGER NOT NULL DEFAULT 0");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export const ITEM_SELECT = `
  SELECT i.*,
    (SELECT COUNT(*) FROM wear_items wi JOIN wears w ON w.id = wi.wear_id WHERE wi.item_id = i.id AND w.planned = 0) AS wears,
    (SELECT MAX(w.date) FROM wear_items wi JOIN wears w ON w.id = wi.wear_id WHERE wi.item_id = i.id AND w.planned = 0) AS last_worn
  FROM items i`;

export function mapItem(r: Row) {
  let attrs: Record<string, unknown> = {};
  try {
    attrs = JSON.parse(r.attrs || "{}");
  } catch {}
  return {
    id: r.id as string,
    name: r.name as string,
    brand: r.brand as string,
    category: r.category as string,
    colorName: r.color_name as string,
    colorHex: r.color_hex as string,
    pattern: r.pattern as string,
    fit: r.fit as string,
    formality: r.formality as number,
    season: r.season as string,
    size: r.size as string,
    price: (r.price ?? null) as number | null,
    purchaseDate: (r.purchase_date ?? null) as string | null,
    notes: r.notes as string,
    attrs,
    image: r.image as string,
    original: (r.original ?? null) as string | null,
    status: r.status as string,
    aiTagged: !!r.ai_tagged,
    createdAt: r.created_at as string,
    wears: (r.wears ?? 0) as number,
    lastWorn: (r.last_worn ?? null) as string | null,
  };
}

export function ok(data: unknown, status = 200) {
  return Response.json(data, { status });
}
export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
