// SQLite in the browser (official sqlite-wasm), persisted in the origin-private file system.
// The wrapper mimics the small part of node:sqlite that Capsule's routes use, so they run unchanged.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

type Bind = unknown[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let raw: any;
export let persistent = false;
export let storageError = "";

const clean = (p: Bind) => p.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v));

function wrap() {
  return {
    exec: (sql: string) => raw.exec(sql),
    prepare: (sql: string) => {
      const all = (...p: Bind) => raw.exec({ sql, bind: p.length ? clean(p) : undefined, rowMode: "object", returnValue: "resultRows" }) as Record<string, unknown>[];
      return {
        all,
        get: (...p: Bind) => all(...p)[0],
        run: (...p: Bind) => {
          raw.exec({ sql, bind: p.length ? clean(p) : undefined });
          return { changes: raw.changes() as number };
        },
      };
    },
  };
}
let api: ReturnType<typeof wrap>;
export const sqlite = () => api;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sqlite3: any = await (sqlite3InitModule as unknown as (o: object) => Promise<unknown>)({ locateFile: (f: string) => `/engine/${f}` });
try {
  const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "capsule", clearOnInit: false });
  raw = new pool.OpfsSAHPoolDb("/capsule.db");
  persistent = true;
} catch (e) {
  storageError = String((e as Error)?.message ?? e);
  if (/Access Handle|NoModificationAllowed/i.test(storageError)) throw new Error("Capsule is already open in another window. Close it there first.");
  raw = new sqlite3.oo1.DB(":memory:", "c"); // private windows etc.: works, but is lost on close
}
api = wrap();
