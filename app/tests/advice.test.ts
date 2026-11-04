import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

process.env.CAPSULE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-advice-"));
delete process.env.GEMINI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

type Seen = { url: string; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const seen: Seen[] = [];
let reply: unknown = {};
let server: http.Server;
let route: typeof import("../app/api/advice/route");
let db: typeof import("../lib/db");
let settings: typeof import("../lib/settings");

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ url: req.url!, body: JSON.parse(raw) });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 200 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  db = await import("../lib/db");
  settings = await import("../lib/settings");
  route = await import("../app/api/advice/route");
});
after(() => server.close());

const post = (body: unknown) => route.POST(new Request("http://x/api/advice", { method: "POST", body: JSON.stringify(body) }));
const saveProfile = (p: unknown) => db.run("INSERT INTO profile (id,data) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data = excluded.data", JSON.stringify(p));
const text = (s: Seen) => s.body.contents[0].parts.map((p: { text?: string }) => p.text ?? "").join("\n");

test("without a key the stylist says it is unavailable", async () => {
  const r = await (await post({ topic: "grooming" })).json();
  assert.equal(r.available, false);
});

test("grooming: the model reads the face-shape knowledge first, and only catalogue ids come back", async () => {
  settings.writeSettings({ geminiKey: "AIzaTEST" });
  saveProfile({ face: { shape: "round", auto: null, overridden: true, wearsGlasses: false }, grooming: { hairType: "wavy", density: "medium", receding: false, length: "short", maintenance: 2, facialHair: true, beardGrowth: "full", saved: [] }, basics: { height: 178, weight: 60, direction: "Menswear", fit: "", aims: [], goals: [] } });
  reply = { summary: "Round face: add height and angles.", hair: [{ id: "quiff", why: "Height lengthens the face." }, { id: "not-a-style", why: "invented" }], beard: [{ id: "goatee", why: "Adds length." }], glasses: [{ id: "rectangular", why: "Angles." }], sunglasses: "Wayfarers.", tips: ["Trim every 3 weeks"] };
  seen.length = 0;
  const r = await (await post({ topic: "grooming" })).json();
  const t = text(seen[0]);
  assert.match(t, /KNOWLEDGE: ROUND FACE/);
  assert.match(t, /Beard works:/);
  assert.match(t, /OPTIONS \(choose only from these ids\)/);
  assert.match(t, /quiff = Quiff/);
  assert.match(seen[0].url, /models\/gemini-3\.5-flash-lite:/, "advice uses the economy advice model");
  assert.equal(seen[0].body.contents[0].parts.length, 1, "no photo → text only");
  assert.deepEqual(r.advice.hair.map((x: { id: string }) => x.id), ["quiff"], "invented ids are dropped");
  assert.equal(r.advice.beard[0].id, "goatee");
  assert.equal(r.advice.glasses[0].id, "rectangular");
  assert.equal(r.usedPhoto, false);
});

test("grooming: a kept face photo is attached when asked, and not when not asked", async () => {
  const jpeg = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#cccccc" } }).jpeg().toBuffer();
  fs.writeFileSync(path.join(db.UPLOAD_DIR, "facetest.jpg"), jpeg);
  saveProfile({ face: { shape: "oval", auto: null, overridden: true, wearsGlasses: false }, avatar: { facePhoto: "facetest.jpg", look: "photo" } });
  reply = { summary: "ok", hair: [], beard: [], glasses: [] };
  seen.length = 0;
  const withPhoto = await (await post({ topic: "grooming", useFacePhoto: true })).json();
  assert.equal(withPhoto.usedPhoto, true);
  assert.equal(seen[0].body.contents[0].parts.length, 2);
  assert.ok(seen[0].body.contents[0].parts[0].inline_data.data.length > 100);
  assert.match(text(seen[0]), /face photo of this person is attached/);
  seen.length = 0;
  const without = await (await post({ topic: "grooming", useFacePhoto: false })).json();
  assert.equal(without.usedPhoto, false);
  assert.equal(seen[0].body.contents[0].parts.length, 1);
});

test("no beard ideas are requested when the person has not asked for them", async () => {
  saveProfile({ face: { shape: "square", auto: null, overridden: true, wearsGlasses: false }, grooming: { facialHair: false, saved: [] } });
  reply = { summary: "s", hair: [], beard: [{ id: "goatee", why: "x" }], glasses: [] };
  seen.length = 0;
  const r = await (await post({ topic: "grooming" })).json();
  assert.match(text(seen[0]), /has not asked for facial-hair ideas/);
  assert.deepEqual(r.advice.beard, []);
});

test("outfits: the briefing carries build, height and the closet, and only real closet pieces come back", async () => {
  saveProfile({ basics: { height: 182, weight: 58, direction: "Menswear", fit: "", aims: [], goals: [] }, face: { shape: "oval", auto: null, overridden: true, wearsGlasses: false } });
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,fit,image,status) VALUES ('i1','Grey tee','Tops','Grey','#999999','regular','a.jpg','active')");
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,fit,image,status) VALUES ('i2','Olive overshirt','Outerwear','Olive','#5a6b4a','regular','b.jpg','active')");
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,fit,image,status) VALUES ('i3','Dark jeans','Bottoms','Navy','#1c2230','straight','c.jpg','active')");
  reply = { summary: "Lean frame: layer.", do: ["Layer a tee under an overshirt"], avoid: ["Single thin layers"], outfits: [{ name: "Layered casual", items: ["Grey tee", "Olive overshirt", "Dark jeans"], why: "Depth." }, { name: "Fake", items: ["Grey tee", "Gold blazer"], why: "x" }] };
  seen.length = 0;
  const r = await (await post({ topic: "outfits", occasion: "dinner" })).json();
  const t = text(seen[0]);
  assert.match(t, /KNOWLEDGE: LEAN BUILD/);
  assert.match(t, /Layer: a tee or shirt under an overshirt/);
  assert.match(t, /KNOWLEDGE: HEIGHT/);
  assert.match(t, /Olive overshirt \[Outerwear, Olive, regular\]/);
  assert.match(t, /OCCASION: dinner/);
  assert.equal(r.advice.outfits.length, 1, "an outfit using a piece you do not own is dropped");
  assert.equal(r.advice.outfits[0].name, "Layered casual");
  assert.equal(r.advice.do.length, 1);
});

test("bad requests are refused", async () => {
  assert.equal((await post({ topic: "something" })).status, 400);
});
