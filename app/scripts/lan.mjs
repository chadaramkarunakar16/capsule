// Starts Capsule so a phone on the same Wi-Fi can reach it — but only if a PIN is set.
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";

let pin = false;
try { pin = !!JSON.parse(fs.readFileSync("data/settings.json", "utf8")).pin; } catch { /* no settings yet */ }
if (!pin) {
  console.error("\nCapsule won't open to your network without a PIN.\nStart it normally (npm run dev), open Me → Privacy & data → Set a PIN, then run this again.\n");
  process.exit(1);
}
const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
console.log(`\nCapsule is reachable on your network. On your phone, open:\n${ips.map((ip) => `  http://${ip}:3000`).join("\n")}\n(Use only on a network you trust — traffic isn't encrypted. Stop with Ctrl+C.)\n`);
const next = process.platform === "win32" ? "npx.cmd" : "npx";
spawn(next, ["next", "dev", "-H", "0.0.0.0", "-p", "3000"], { stdio: "inherit", env: { ...process.env, CAPSULE_LAN: "1" }, shell: process.platform === "win32" });
