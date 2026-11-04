import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.CAPSULE_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

import { SCHEMA, migrate, type Row } from "./db-core";
export { ITEM_SELECT, mapItem, ok, fail, uid, type Row } from "./db-core";

declare global {
  var __capsuleDb: DatabaseSync | undefined;
}

function init() {
  const d = new DatabaseSync(path.join(DATA_DIR, "capsule.db"));
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  d.exec(SCHEMA);
  migrate(d);
  return d;
}

export const db: DatabaseSync = (globalThis.__capsuleDb ??= init());

export const all = (sql: string, ...p: unknown[]) =>
  db.prepare(sql).all(...(p as never[])) as Row[];
export const get = (sql: string, ...p: unknown[]) =>
  db.prepare(sql).get(...(p as never[])) as Row | undefined;
export const run = (sql: string, ...p: unknown[]) =>
  db.prepare(sql).run(...(p as never[]));

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

