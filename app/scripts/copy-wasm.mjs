// Keeps public/mediapipe/wasm in sync with the installed @mediapipe/tasks-vision package.
import fs from "node:fs";
import path from "node:path";
const src = path.join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const dst = path.join("public", "mediapipe", "wasm");
if (fs.existsSync(src)) {
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}
