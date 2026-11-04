// Downloads the on-device background-removal model into public/imgly once, so cut-outs work offline and
// start instantly instead of pulling ~55 MB from a CDN the first time someone adds a photo.
// Only the small model (isnet_quint8) and the CPU runtime are fetched. Safe to re-run; failures are non-fatal.
import fs from "node:fs";
import path from "node:path";

const VERSION = "1.7.0";
const BASE = `https://staticimgly.com/@imgly/background-removal-data/${VERSION}/dist/`;
const OUT = "public/imgly";
const KEEP = ["/models/isnet_quint8", "/onnxruntime-web/ort-wasm-simd-threaded.wasm", "/onnxruntime-web/ort-wasm-simd-threaded.mjs"];

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

try {
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, "resources.json");
  const all = JSON.parse((await get(BASE + "resources.json")).toString("utf8"));
  const wanted = Object.fromEntries(KEEP.map((k) => [k, all[k]]));
  const hashes = [...new Set(Object.values(wanted).flatMap((e) => e.chunks.map((c) => c.hash)))];
  const missing = hashes.filter((h) => !fs.existsSync(path.join(OUT, h)));
  if (missing.length) console.log(`Fetching background-removal model: ${missing.length} files…`);
  for (let i = 0; i < missing.length; i += 4) {
    await Promise.all(missing.slice(i, i + 4).map(async (h) => fs.writeFileSync(path.join(OUT, h), await get(BASE + h))));
  }
  fs.writeFileSync(manifestPath, JSON.stringify(wanted));
  console.log(missing.length ? "Background-removal model ready." : "Background-removal model already present.");
} catch (e) {
  console.warn(`Could not fetch the background-removal model (${e.message}). Cut-outs will download it on first use instead.`);
}
