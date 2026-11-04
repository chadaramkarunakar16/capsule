// Drop-in for lib/db.ts inside the browser engine.
import { SCHEMA, migrate, type Row } from "../lib/db-core";
import { sqlite } from "./sqlite";
export { ITEM_SELECT, mapItem, ok, fail, uid, type Row } from "../lib/db-core";

export const DATA_DIR = "/data";
export const UPLOAD_DIR = "/data/uploads";

export const db = sqlite();
db.exec("PRAGMA foreign_keys = ON;");
db.exec(SCHEMA);
db.exec("CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, size INTEGER NOT NULL, data BLOB NOT NULL)");
migrate(db as never);

export const all = (sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as Row[];
export const get = (sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as Row | undefined;
export const run = (sql: string, ...p: unknown[]) => db.prepare(sql).run(...p);
export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
