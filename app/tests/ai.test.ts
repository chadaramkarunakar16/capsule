import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

process.env.CAPSULE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-ai-"));
for (const k of ["GEMINI_API_KEY", "OPENAI_API_KEY"]) delete process.env[k];

type Seen = { url: string; headers: http.IncomingHttpHeaders; body: Record<string, any>; raw: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const seen: Seen[] = [];
let reject400Once: RegExp | null = null;
let status: { code: number; body: unknown } | null = null;
let server: http.Server;
let ai: typeof import("../lib/ai");
let settings: typeof import("../lib/settings");
let db: typeof import("../lib/db");
let jpeg: Buffer;

const PNG64 = Buffer.from("PNGDATA").toString("base64");
const gem = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 20 } });

before(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("latin1");
      const isJson = (req.headers["content-type"] ?? "").includes("json");
      const body = isJson ? JSON.parse(raw) : {};
      seen.push({ url: req.url!, headers: req.headers, body, raw });
      res.setHeader("content-type", "application/json");
      if (status) { res.statusCode = status.code; return res.end(JSON.stringify(status.body)); }
      if (reject400Once && reject400Once.test(raw)) { reject400Once = null; res.statusCode = 400; return res.end(JSON.stringify({ error: { message: "Unknown parameter: reasoning.effort / imageConfig / thinkingConfig / size" } })); }
      if (req.url!.startsWith("/v1beta/")) {
        if (req.url!.includes("-image:")) return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: PNG64 } }] } }], usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 1290 } }));
        return res.end(JSON.stringify(gem('Sure: {"name":"Navy tee"}')));
      }
      if (req.url === "/v1/responses") return res.end(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: '{"name":"Navy tee"}' }] }], usage: { input_tokens: 400, output_tokens: 30 } }));
      if (req.url === "/v1/images/edits") return res.end(JSON.stringify({ data: [{ b64_json: PNG64 }], usage: { input_tokens: 900, output_tokens: 1056 } }));
      res.statusCode = 404; res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.GEMINI_BASE_URL = base;
  process.env.OPENAI_BASE_URL = base;
  jpeg = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#335577" } }).jpeg().toBuffer();
  ai = await import("../lib/ai");
  settings = await import("../lib/settings");
  db = await import("../lib/db");
});
after(() => server.close());

const ask = (f: "tag" | "face" | "body" | "split" | "look" | "advice", extra: object = {}) => ai.askJSON(f, { image: jpeg, mime: "image/jpeg", prompt: "p", ...extra });
const model = (s: Seen) => (s.url.match(/models\/([^:]+):/)?.[1] ?? (s.body.model as string));
const use = (s: object) => settings.writeSettings(s);
const ref = [{ data: new Uint8Array([1, 2, 3]), mime: "image/jpeg" }];

test("no key → AI is not available and says what to do", async () => {
  assert.equal(ai.aiReady(), false);
  assert.equal(ai.provider(), null);
  await assert.rejects(ask("tag"), /Add an AI key/);
});

test("provider choice: only the saved key, your pick when both, Gemini first when you have not picked", () => {
  use({ geminiKey: "g" }); assert.equal(ai.provider(), "gemini");
  use({ openaiKey: "o" }); assert.equal(ai.provider(), "openai");
  use({ geminiKey: "g", openaiKey: "o" }); assert.equal(ai.provider(), "gemini");
  use({ geminiKey: "g", openaiKey: "o", aiProvider: "openai" }); assert.equal(ai.provider(), "openai");
  use({ geminiKey: "g", aiProvider: "openai" }); assert.equal(ai.provider(), "gemini", "a pick without its key is ignored");
});

test("Gemini Economy: ONE text model for every reading and thinking job, two picture models", async () => {
  use({ geminiKey: "AIzaTEST" });
  seen.length = 0;
  for (const f of ["tag", "face", "body", "split", "look", "advice"] as const) assert.deepEqual(await ask(f, { brain: false }), { name: "Navy tee" });
  assert.deepEqual([...new Set(seen.map(model))], ["gemini-3.5-flash-lite"]);
  assert.ok(seen.every((s) => s.headers["x-goog-api-key"] === "AIzaTEST" && !s.url.includes("AIza")), "key goes in the header, not the URL");
  assert.equal(ai.modelFor("edit"), "gemini-2.5-flash-image");
  assert.equal(ai.modelFor("likeness"), "gemini-3.1-flash-image");
});

test("Gemini Better: only the reasoning jobs and picture editing step up", async () => {
  use({ geminiKey: "AIzaTEST", aiQuality: "better" });
  seen.length = 0;
  for (const f of ["tag", "face", "split", "look", "advice"] as const) await ask(f, { brain: false });
  assert.deepEqual(seen.map(model), ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.6-flash"]);
  assert.equal(ai.modelFor("edit"), "gemini-3.1-flash-image");
  use({ geminiKey: "AIzaTEST" });
});

test("cost controls are on the request: minimal thinking for reading, lowest image detail for single pieces, JSON mode", async () => {
  seen.length = 0;
  await ask("tag", { brain: false }); await ask("split", { brain: false });
  const [tag, split] = seen;
  assert.equal(tag.body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
  assert.equal(split.body.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.equal(tag.body.generationConfig.mediaResolution, "MEDIA_RESOLUTION_LOW");
  assert.equal(split.body.generationConfig.mediaResolution, "MEDIA_RESOLUTION_MEDIUM");
  assert.equal(tag.body.generationConfig.responseMimeType, "application/json");
});

test("photos are shrunk before sending (3000px → ≤768px for tagging)", async () => {
  seen.length = 0;
  await ask("tag", { brain: false });
  const sent = Buffer.from(seen[0].body.contents[0].parts[0].inline_data.data, "base64");
  const meta = await sharp(sent).metadata();
  assert.ok(Math.max(meta.width!, meta.height!) <= 768, `sent ${meta.width}x${meta.height}`);
  assert.ok(sent.length < jpeg.length);
});

test("a model that rejects the cost-saving options is retried without them (Gemini)", async () => {
  seen.length = 0;
  reject400Once = /thinkingConfig/;
  assert.deepEqual(await ask("tag", { brain: false }), { name: "Navy tee" });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].body.generationConfig.thinkingConfig, undefined);
});

test("usage is counted per month and per model", async () => {
  use({ geminiKey: "AIzaTEST" });
  await ask("tag", { brain: false }); await ask("tag", { brain: false });
  const month = new Date().toISOString().slice(0, 7);
  const u = settings.readSettings().aiUsage![month];
  assert.equal(u.calls, 2);
  assert.equal(u.inTok, 600);
  assert.equal(u.byModel["gemini-3.5-flash-lite"], 2);
});

test("friendly errors for a bad key and for quota (Gemini)", async () => {
  status = { code: 400, body: { error: { message: "API key not valid." } } };
  await assert.rejects(ask("tag", { brain: false }), /didn’t accept that key/);
  status = { code: 429, body: { error: { message: "quota" } } };
  await assert.rejects(ask("tag", { brain: false }), /rate or quota/);
  status = null;
});

test("Gemini pictures: portrait ratio, and a retry without it if the model refuses the option", async () => {
  seen.length = 0;
  const out = await ai.makeImage("likeness", "p", ref, { aspect: "portrait" });
  assert.equal(out.mime, "image/png");
  assert.equal(Buffer.from(out.data).toString(), "PNGDATA");
  assert.equal(seen[0].body.generationConfig.imageConfig.aspectRatio, "2:3");
  assert.deepEqual(seen[0].body.generationConfig.responseModalities, ["IMAGE"]);
  assert.match(seen[0].url, /gemini-3\.1-flash-image:/);
  seen.length = 0;
  reject400Once = /imageConfig/;
  await ai.makeImage("edit", "p", ref, { aspect: "portrait" });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].body.generationConfig.imageConfig, undefined);
});

test("a refused picture is explained, not shown as a blank result", async () => {
  const orig = server.listeners("request")[0] as http.RequestListener;
  server.removeAllListeners("request");
  server.on("request", (req, res) => { req.resume(); req.on("end", () => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [{ text: "I cannot edit this photo." }] } }] })); }); });
  await assert.rejects(ai.makeImage("edit", "p", ref), /didn.t return a picture/);
  server.removeAllListeners("request");
  server.on("request", orig);
});

/* ---------------------------------------------------------------- OpenAI */

test("OpenAI Economy: ONE text model (gpt-6-luna) for everything, two picture models", async () => {
  use({ openaiKey: "sk-test" });
  assert.equal(ai.provider(), "openai");
  seen.length = 0;
  for (const f of ["tag", "face", "split", "advice"] as const) assert.deepEqual(await ask(f, { brain: false }), { name: "Navy tee" });
  assert.deepEqual([...new Set(seen.map(model))], ["gpt-6-luna"]);
  assert.ok(seen.every((s) => s.url === "/v1/responses" && s.headers.authorization === "Bearer sk-test"));
  assert.equal(ai.modelFor("edit"), "gpt-image-2.5-flare");
  assert.equal(ai.modelFor("likeness"), "gpt-image-2.5-sunburst");
});

test("OpenAI Better: only reasoning jobs step up to gpt-6.1-terra", async () => {
  use({ openaiKey: "sk-test", aiQuality: "better" });
  seen.length = 0;
  await ask("tag", { brain: false }); await ask("advice", { brain: false });
  assert.deepEqual(seen.map(model), ["gpt-6-luna", "gpt-6.1-terra"]);
  assert.equal(ai.modelFor("edit"), "gpt-image-2.5-sunburst");
  use({ openaiKey: "sk-test" });
});

test("OpenAI request shape: JSON output, no reasoning for reading, low (with room) for thinking, low image detail for single pieces", async () => {
  seen.length = 0;
  await ask("tag", { brain: false, maxTokens: 500 }); await ask("split", { brain: false, maxTokens: 500 });
  const [tag, split] = seen.map((s) => s.body);
  assert.deepEqual(tag.text, { format: { type: "json_object" } });
  assert.equal(tag.reasoning.effort, "none");
  assert.equal(split.reasoning.effort, "low");
  assert.equal(tag.max_output_tokens, 500);
  assert.equal(split.max_output_tokens, 1000, "thinking needs headroom in the output budget");
  assert.equal(tag.input[0].content[0].type, "input_text");
  assert.equal(tag.input[0].content[1].type, "input_image");
  assert.match(tag.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(tag.input[0].content[1].detail, "low");
  assert.equal(split.input[0].content[1].detail, "auto");
});

test("OpenAI: reads output_text too, retries without reasoning/detail if rejected, friendly errors", async () => {
  const orig = server.listeners("request")[0] as http.RequestListener;
  server.removeAllListeners("request");
  server.on("request", (req, res) => { req.resume(); req.on("end", () => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ output_text: '{"ok":1}', usage: { input_tokens: 1, output_tokens: 1 } })); }); });
  assert.deepEqual(await ask("tag", { brain: false }), { ok: 1 });
  server.removeAllListeners("request");
  server.on("request", orig);
  seen.length = 0;
  reject400Once = /reasoning/;
  assert.deepEqual(await ask("tag", { brain: false }), { name: "Navy tee" });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].body.reasoning, undefined);
  status = { code: 401, body: { error: { message: "bad key" } } };
  await assert.rejects(ask("tag", { brain: false }), /OpenAI didn’t accept that key/);
  status = { code: 429, body: { error: { message: "limit" } } };
  await assert.rejects(ask("tag", { brain: false }), /rate limit or run out of credit/);
  status = null;
});

test("OpenAI pictures: multipart edit with every reference, portrait size, base64 result decoded", async () => {
  seen.length = 0;
  const out = await ai.makeImage("likeness", "make it me", [...ref, ...ref], { aspect: "portrait" });
  assert.equal(Buffer.from(out.data).toString(), "PNGDATA");
  const s = seen[0];
  assert.equal(s.url, "/v1/images/edits");
  assert.match(String(s.headers["content-type"]), /^multipart\/form-data/);
  assert.equal((s.raw.match(/name="image\[\]"/g) ?? []).length, 2);
  assert.match(s.raw, /name="model"\r\n\r\ngpt-image-2\.5-sunburst/);
  assert.match(s.raw, /name="size"\r\n\r\n1024x1536/);
  assert.match(s.raw, /name="prompt"\r\n\r\nmake it me/);
  seen.length = 0;
  reject400Once = /name="size"/;
  await ai.makeImage("edit", "p", ref);
  assert.equal(seen.length, 2);
  assert.doesNotMatch(seen[1].raw, /name="size"/, "retried with only the essentials");
  assert.match(seen[1].raw, /gpt-image-2\.5-flare/);
});

/* ---------------------------------------------------------------- the shared brain */

test("brain: reading features carry the app memory; photo-reading features do not; brain:false skips it", async () => {
  use({ geminiKey: "AIzaTEST" });
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,image,status) VALUES ('b1','Olive overshirt','Outerwear','Olive','#5a6b4a','a.jpg','active')");
  db.run("INSERT INTO brain_events (id,kind,data) VALUES ('e1','item.corrected','{\"name\":\"Cream knit\",\"changes\":[{\"field\":\"category\",\"from\":\"Tops\",\"to\":\"Outerwear\"}]}')");
  const text = (s: Seen) => s.body.contents[0].parts.map((p: { text?: string }) => p.text ?? "").join("\n");
  seen.length = 0;
  await ask("tag");
  assert.match(text(seen[0]), /APP MEMORY/);
  assert.match(text(seen[0]), /Closet: 1 pieces \(Outerwear/);
  assert.match(text(seen[0]), /corrected earlier AI labels.*category "Tops" -> "Outerwear"/);
  seen.length = 0;
  await ask("face");
  assert.doesNotMatch(text(seen[0]), /APP MEMORY/);
  seen.length = 0;
  await ask("tag", { brain: false });
  assert.doesNotMatch(text(seen[0]), /APP MEMORY/);
});
