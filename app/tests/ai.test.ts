import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

process.env.CAPSULE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-ai-"));
delete process.env.GEMINI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

type Seen = { url: string; key?: string | undefined; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const seen: Seen[] = [];
let reject400Once = false;
let noPicture = false;
let server: http.Server;
let ai: typeof import("../lib/ai");
let settings: typeof import("../lib/settings");
let jpeg: Buffer;

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      seen.push({ url: req.url!, key: req.headers["x-goog-api-key"] as string | undefined, body });
      res.setHeader("content-type", "application/json");
      if (reject400Once && body.generationConfig.thinkingConfig) {
        reject400Once = false;
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: { message: "Unknown name \"thinkingConfig\"" } }));
      }
      if (req.url!.includes("-image:")) {
        if (noPicture) return res.end(JSON.stringify({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [{ text: "I cannot edit this photo." }] } }] }));
        return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: Buffer.from("PNGDATA").toString("base64") } }] } }], usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 1290 } }));
      }
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Sure: {\"name\":\"Navy tee\"}" }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 20 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#335577" } }).jpeg().toBuffer();
  ai = await import("../lib/ai");
  settings = await import("../lib/settings");
});
after(() => server.close());

const ask = (f: "tag" | "split" | "look") => ai.askJSON(f, { image: jpeg, mime: "image/jpeg", prompt: "p" });

test("no key → AI is not available", () => {
  assert.equal(ai.aiReady(), false);
  assert.equal(ai.aiProvider(), null);
});

test("economy routing: the cheapest model that can do each job", async () => {
  settings.writeSettings({ geminiKey: "AIzaTEST" });
  assert.equal(ai.aiProvider(), "gemini");
  seen.length = 0;
  for (const f of ["tag", "split", "look"] as const) assert.deepEqual(await ask(f), { name: "Navy tee" });
  assert.deepEqual(seen.map((s) => s.url.match(/models\/([^:]+):/)![1]), ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]);
  assert.ok(seen.every((s) => s.key === "AIzaTEST"), "key goes in the header, not the URL");
  assert.ok(seen.every((s) => !s.url.includes("AIza")));
});

test("cost controls are on the request: minimal thinking, lowest image detail for single garments, JSON mode", async () => {
  const [tag, split] = seen;
  assert.equal(tag.body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
  assert.equal(tag.body.generationConfig.mediaResolution, "MEDIA_RESOLUTION_LOW");
  assert.equal(split.body.generationConfig.mediaResolution, "MEDIA_RESOLUTION_MEDIUM");
  assert.equal(tag.body.generationConfig.responseMimeType, "application/json");
});

test("photos are shrunk before sending (3000px → ≤768px for tagging)", async () => {
  const sent = Buffer.from(seen[0].body.contents[0].parts[0].inline_data.data, "base64");
  const meta = await sharp(sent).metadata();
  assert.ok(Math.max(meta.width!, meta.height!) <= 768, `sent ${meta.width}x${meta.height}`);
  assert.ok(sent.length < jpeg.length);
});

test("'Better' moves the photo-heavy features up one step and the tag step to the next lite model", async () => {
  settings.writeSettings({ ...settings.readSettings(), aiQuality: "better" });
  seen.length = 0;
  for (const f of ["tag", "split", "look"] as const) await ask(f);
  assert.deepEqual(seen.map((s) => s.url.match(/models\/([^:]+):/)![1]), ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.6-flash"]);
  settings.writeSettings({ ...settings.readSettings(), aiQuality: "economy" });
});

test("if a model rejects the cost-saving options, the call is retried without them", async () => {
  seen.length = 0;
  reject400Once = true;
  assert.deepEqual(await ask("tag"), { name: "Navy tee" });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].body.generationConfig.thinkingConfig, undefined);
});

test("usage is counted per month and per model", () => {
  const month = new Date().toISOString().slice(0, 7);
  const u = settings.readSettings().aiUsage![month];
  assert.ok(u.calls >= 7 && u.inTok >= 2100);
  assert.ok(u.byModel["gemini-3.1-flash-lite"] >= 1 && u.byModel["gemini-3.6-flash"] >= 2);
});

test("friendly errors for a bad key and for quota", async () => {
  const orig = server.listeners("request")[0] as http.RequestListener;
  server.removeAllListeners("request");
  server.on("request", (_q, res) => { res.statusCode = 400; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: { message: "API key not valid. Please pass a valid API key." } })); });
  await assert.rejects(ask("tag"), /didn’t accept that key/);
  server.removeAllListeners("request");
  server.on("request", (_q, res) => { res.statusCode = 429; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ error: { message: "quota" } })); });
  await assert.rejects(ask("tag"), /rate or quota/);
  server.removeAllListeners("request");
  server.on("request", orig);
});

test("try-on: cheapest multi-reference image model by default, stronger one on Better", () => {
  assert.deepEqual(ai.TRYON_MODELS.economy, { model: "gemini-2.5-flash-image", garmentsPerCall: 2 });
  assert.equal(ai.TRYON_MODELS.better.model, "gemini-3.1-flash-image");
});

test("try-on: person first, then garments, image-only output; the picture comes back decoded", async () => {
  seen.length = 0;
  const refs = [1, 2, 3].map((n) => ({ data: new Uint8Array([n, n, n]), mime: "image/jpeg" }));
  const out = await ai.geminiImage(ai.TRYON_MODELS.economy.model, "dress image 1", refs);
  assert.equal(out.mime, "image/png");
  assert.equal(Buffer.from(out.data).toString(), "PNGDATA");
  const body = seen[0].body;
  assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
  assert.equal(body.contents[0].parts.length, 4, "3 photos + the instruction");
  assert.equal(body.contents[0].parts[3].text, "dress image 1");
  assert.match(seen[0].url, /gemini-2\.5-flash-image:generateContent/);
});

test("try-on: a refusal is explained, not shown as a blank result", async () => {
  noPicture = true;
  await assert.rejects(ai.geminiImage("gemini-2.5-flash-image", "p", [{ data: new Uint8Array([1]), mime: "image/jpeg" }]), /didn.t return a picture.*IMAGE_SAFETY|didn.t return a picture.*cannot edit/);
  noPicture = false;
});

test("try-on provider: your pick if its key exists, else Gemini, else FASHN", () => {
  const base = { geminiKey: "AIzaTEST" };
  settings.writeSettings({ ...base });
  assert.equal(settings.tryonProvider(), "gemini");
  settings.writeSettings({ ...base, fashnKey: "f" });
  assert.equal(settings.tryonProvider(), "gemini", "both keys: Gemini unless you choose FASHN");
  settings.writeSettings({ ...base, fashnKey: "f", tryonProvider: "fashn" });
  assert.equal(settings.tryonProvider(), "fashn");
  settings.writeSettings({ fashnKey: "f", tryonProvider: "gemini" });
  assert.equal(settings.tryonProvider(), "fashn", "a pick without its key is ignored");
  settings.writeSettings({});
  assert.equal(settings.tryonProvider(), null);
  settings.writeSettings({ geminiKey: "AIzaTEST" });
});

test("the picture of you always uses the stronger identity-keeping image model", () => {
  assert.equal(ai.AVATAR_MODEL, "gemini-3.1-flash-image");
});

test("image calls can ask for a portrait aspect ratio and fall back if the model refuses the option", async () => {
  seen.length = 0;
  const out = await ai.geminiImage(ai.AVATAR_MODEL, "p", [{ data: new Uint8Array([1]), mime: "image/jpeg" }], { aspect: "2:3" });
  assert.equal(out.mime, "image/png");
  assert.equal(seen[0].body.generationConfig.imageConfig.aspectRatio, "2:3");
  // a model that rejects imageConfig → retried without it
  const orig = server.listeners("request")[0] as http.RequestListener;
  server.removeAllListeners("request");
  let n = 0;
  server.on("request", (req, res) => {
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      const b = JSON.parse(raw); seen.push({ url: req.url!, body: b }); n++;
      res.setHeader("content-type", "application/json");
      if (b.generationConfig.imageConfig) { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: "Unknown name \"imageConfig\"" } })); }
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: Buffer.from("OK").toString("base64") } }] } }] }));
    });
  });
  seen.length = 0;
  const out2 = await ai.geminiImage(ai.AVATAR_MODEL, "p", [{ data: new Uint8Array([1]), mime: "image/jpeg" }], { aspect: "2:3" });
  assert.equal(Buffer.from(out2.data).toString(), "OK");
  assert.equal(n, 2);
  assert.equal(seen[1].body.generationConfig.imageConfig, undefined);
  server.removeAllListeners("request");
  server.on("request", orig);
});
