// Builds the self-contained server the Windows app carries: .next/standalone (+ static files + public assets).
import fs from "node:fs";
import { execSync } from "node:child_process";

const env = { ...process.env, CAPSULE_DESKTOP: "1" };
execSync("npx next build", { stdio: "inherit", env });
const out = ".next/standalone";
fs.cpSync(".next/static", `${out}/.next/static`, { recursive: true });
fs.cpSync("public", `${out}/public`, { recursive: true });
// the standalone copy must never carry a developer's personal data or keys
for (const junk of ["data", "out", "dist", ".static-build", "engine", "public/engine", "docs", "tests", "android"]) fs.rmSync(`${out}/${junk}`, { recursive: true, force: true });
// nothing that looks like a model or a wasm runtime may ship inside the desktop app
const risky = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(f); } else if (/\.(wasm|onnx|tflite|task)$/i.test(e.name)) risky.push(f);
  }
})(out);
if (risky.length) throw new Error("Unexpected model/wasm files in the desktop server:\n" + risky.join("\n"));
console.log("\nDesktop server ready in .next/standalone");
