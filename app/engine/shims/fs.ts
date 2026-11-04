// `node:fs` for the browser engine: files live in a `files` table inside the same SQLite database,
// so photos, settings and models are persisted, transactional and part of one backup.
import { Buffer } from "buffer";
import { sqlite } from "../sqlite";
import { join } from "./path";

const key = (p: string) => join(String(p));
const rows = (sql: string, ...p: unknown[]) => sqlite().prepare(sql).all(...(p as never[])) as Record<string, unknown>[];

export const existsSync = (p: string) => rows("SELECT 1 AS x FROM files WHERE path = ?", key(p)).length > 0;
export function readFileSync(p: string, enc?: string) {
  const r = rows("SELECT data FROM files WHERE path = ?", key(p))[0];
  if (!r) { const e = new Error(`ENOENT: ${p}`) as Error & { code: string }; e.code = "ENOENT"; throw e; }
  const b = Buffer.from(r.data as Uint8Array);
  return enc ? b.toString(enc as BufferEncoding) : b;
}
export function writeFileSync(p: string, data: string | Uint8Array) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  sqlite().prepare("INSERT OR REPLACE INTO files (path, size, data) VALUES (?,?,?)").run(key(p), bytes.length, bytes);
}
export function rmSync(p: string, o?: { recursive?: boolean }) {
  const k = key(p);
  sqlite().prepare("DELETE FROM files WHERE path = ?").run(k);
  if (o?.recursive) sqlite().prepare("DELETE FROM files WHERE path LIKE ?").run(k + "/%");
}
export const unlinkSync = (p: string) => rmSync(p);
export function renameSync(a: string, b: string) {
  sqlite().prepare("UPDATE OR REPLACE files SET path = ? WHERE path = ?").run(key(b), key(a));
}
export const mkdirSync = () => undefined;
export function readdirSync(dir: string) {
  const d = key(dir);
  const names = rows("SELECT path FROM files WHERE path LIKE ?", (d === "/" ? "" : d) + "/%").map((r) => (r.path as string).slice(d.length + 1).split("/")[0]);
  return [...new Set(names)];
}
export function statSync(p: string) {
  const r = rows("SELECT size FROM files WHERE path = ?", key(p))[0];
  if (!r) { const e = new Error(`ENOENT: ${p}`) as Error & { code: string }; e.code = "ENOENT"; throw e; }
  return { size: r.size as number, isFile: () => true, isDirectory: () => false };
}
export default { existsSync, readFileSync, writeFileSync, rmSync, unlinkSync, renameSync, mkdirSync, readdirSync, statSync };
