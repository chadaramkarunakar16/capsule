// Bundles the in-browser engine into public/engine/ (worker + sqlite wasm).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

execFileSync("node", ["scripts/gen-engine-routes.mjs"], { stdio: "inherit" });
fs.mkdirSync("public/engine", { recursive: true });
fs.copyFileSync("node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm", "public/engine/sqlite3.wasm");
const e = (f) => path.resolve("engine", f);

await build({
  entryPoints: ["engine/worker.ts"],
  outfile: "public/engine/worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  logLevel: "info",
  tsconfig: "tsconfig.json",
  alias: {
    "node:fs": e("shims/fs.ts"),
    "node:path": e("shims/path.ts"),
    "@/lib/db": e("db.ts"),
    "@/lib/auth": e("auth.ts"),
    sharp: e("shims/empty.ts"),
    "node:module": e("shims/module.ts"),
    "node:net": e("shims/net.ts"),
    "node:dns/promises": e("shims/dns.ts"),
  },
  plugins: [
    {
      // relative imports of lib/db (from lib/queries.ts, lib/shop/db.ts, ...) get the browser version too
      name: "engine-db",
      setup(b) {
        const target = path.resolve("lib/db");
        b.onResolve({ filter: /^\.{1,2}\/(.*\/)?db$/ }, (a) => (path.resolve(a.resolveDir, a.path) === target ? { path: e("db.ts") } : undefined));
      },
    },
  ],
  define: { "process.env.NODE_ENV": '"production"' },
  inject: [e("shims/process.ts")],
  external: [],
});
