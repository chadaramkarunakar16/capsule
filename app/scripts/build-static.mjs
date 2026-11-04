// Hosted build: the UI as static files in out/, with the engine in public/engine and the relay as a Pages Function.
// Next can't export route handlers, so the build runs in a throwaway copy (.static-build) that leaves out the
// server-only folders. Your source tree is never moved or modified.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const WORK = ".static-build";
const SERVER_ONLY = new Set(["app/api", "app/proxy", "app/share", "app/unlock", "proxy.ts"]);
const SKIP = new Set(["node_modules", ".next", "out", "data", WORK, ".git", "functions", "android", "docs", "engine", "relay", "scripts", "tests"]);
const env = { ...process.env, CAPSULE_STATIC: "1", NEXT_PUBLIC_ENGINE: "browser" };

execSync("node scripts/copy-wasm.mjs", { stdio: "inherit", env });
execSync("node scripts/build-engine.mjs", { stdio: "inherit", env });

fs.rmSync(WORK, { recursive: true, force: true });
(function copy(src, dst, rel) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if ((!rel && SKIP.has(e.name)) || SERVER_ONLY.has(r)) continue;
    if (e.isDirectory()) copy(path.join(src, e.name), path.join(dst, e.name), r);
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
})(".", WORK, "");
fs.symlinkSync(path.resolve("node_modules"), path.join(WORK, "node_modules"), "junction");

try {
  execSync("npx next build", { cwd: WORK, stdio: "inherit", env });
  fs.rmSync("out", { recursive: true, force: true });
  fs.cpSync(path.join(WORK, "out"), "out", { recursive: true });
} finally {
  fs.rmSync(path.join(WORK, "node_modules"), { force: true }); // remove the junction only, never its target
  if (fs.existsSync(path.join(WORK, "node_modules"))) console.warn(`Left ${WORK} in place: couldn't unlink the node_modules junction. Delete it by hand.`);
  else fs.rmSync(WORK, { recursive: true, force: true });
}
console.log("\nStatic build ready in out/");
