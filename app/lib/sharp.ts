import { createRequire } from "node:module";
import path from "node:path";

// sharp is a native module. Loading it through plain Node resolution (not the bundler) keeps it working
// from the packaged desktop app, where the server carries its own node_modules folder next to it.
type Sharp = typeof import("sharp").default;
let cached: Sharp | null = null;

export function loadSharp(): Sharp {
  if (!cached) {
    const req = createRequire(path.join(process.cwd(), "noop.js"));
    const m = req("sharp");
    cached = (m.default ?? m) as Sharp;
  }
  return cached;
}
