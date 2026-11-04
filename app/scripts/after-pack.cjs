// electron-builder drops every node_modules folder from extraResources, but the built-in server needs its own.
// Copy it in after packaging.
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const from = path.join(__dirname, "..", ".next", "standalone", "node_modules");
  const to = path.join(context.appOutDir, "resources", "server", "node_modules");
  if (!fs.existsSync(from)) throw new Error(`Run "npm run desktop:build" first: ${from} is missing`);
  fs.cpSync(from, to, { recursive: true });
  // sharp is loaded by plain Node resolution (see lib/sharp.ts), so bundle it and its runtime packages explicitly
  const root = path.join(__dirname, "..", "node_modules");
  const want = ["sharp", "@img/colour", "@img/sharp-win32-x64", "detect-libc", "semver"];
  for (const name of want) {
    const src = path.join(root, name);
    const dst = path.join(to, name);
    if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true, force: true, dereference: true });
  }
  console.log(`  • copied server node_modules -> ${to}`);
};
