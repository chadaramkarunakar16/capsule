// Builds the self-contained server the Windows app carries: .next/standalone (+ static files + public assets).
import fs from "node:fs";
import { execSync } from "node:child_process";

const env = { ...process.env, CAPSULE_DESKTOP: "1" };
execSync("node scripts/copy-wasm.mjs", { stdio: "inherit" });
execSync("node scripts/fetch-imgly.mjs", { stdio: "inherit" });
execSync("npx next build", { stdio: "inherit", env });
const out = ".next/standalone";
fs.cpSync(".next/static", `${out}/.next/static`, { recursive: true });
fs.cpSync("public", `${out}/public`, { recursive: true });
// the standalone copy must never carry a developer's personal data or keys
fs.rmSync(`${out}/data`, { recursive: true, force: true });
console.log("\nDesktop server ready in .next/standalone");
