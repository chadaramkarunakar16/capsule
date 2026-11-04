import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

process.env.CAPSULE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-brain-"));
for (const k of ["GEMINI_API_KEY", "OPENAI_API_KEY"]) delete process.env[k];

type Seen = { url: string; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const seen: Seen[] = [];
let server: http.Server;
/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any, settings: any, brainRoute: any, itemRoute: any, feedbackRoute: any, wearsRoute: any, outfitsRoute: any, looksRoute: any, lookRoute: any, productRoute: any, profileRoute: any, reflect: any, context: any, events: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const MEMORY = { summary: "Likes earthy layers and relaxed fits; sorts overshirts as outerwear.", likes: ["olive", "overshirts"], dislikes: ["skinny jeans"], rules: ["Suggest a layer over tees"], tagHints: ["overshirt = Outerwear"] };

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push({ url: req.url!, body: JSON.parse(raw) });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(MEMORY) }] } }], usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 120 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  db = await import("../lib/db");
  settings = await import("../lib/settings");
  events = await import("../lib/brain/events");
  context = await import("../lib/brain/context");
  reflect = await import("../lib/brain/reflect");
  brainRoute = await import("../app/api/brain/route");
  itemRoute = await import("../app/api/items/[id]/route");
  feedbackRoute = await import("../app/api/feedback/route");
  wearsRoute = await import("../app/api/wears/route");
  outfitsRoute = await import("../app/api/outfits/route");
  looksRoute = await import("../app/api/looks/route");
  lookRoute = await import("../app/api/looks/[id]/route");
  productRoute = await import("../app/api/products/[id]/route");
  profileRoute = await import("../app/api/profile/route");
});
after(() => server.close());

const json = (body: unknown, method = "POST") => new Request("http://x/", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const kinds = () => db.all("SELECT kind FROM brain_events ORDER BY at, rowid").map((r: { kind: string }) => r.kind);
const lastData = (kind: string) => JSON.parse(db.get("SELECT data FROM brain_events WHERE kind = ? ORDER BY at DESC, rowid DESC", kind).data);
const wipe = () => { db.run("DELETE FROM brain_events"); db.run("DELETE FROM brain_memory"); };

test("fixing what the AI got wrong is recorded as a correction; confirming and deleting are recorded too", async () => {
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,fit,image,status,ai_tagged) VALUES ('d1','Olive overshirt','Tops','Olive','#5a6b4a','relaxed','a.jpg','draft',1)");
  await itemRoute.PATCH(json({ category: "Outerwear", name: "Olive overshirt", status: "active" }, "PATCH"), ctx("d1"));
  const c = lastData("item.corrected");
  assert.deepEqual(c.changes, [{ field: "category", from: "Tops", to: "Outerwear" }]);
  assert.ok(kinds().includes("item.confirmed"));
  assert.equal(lastData("item.confirmed").corrected, true);
  await itemRoute.DELETE(new Request("http://x/", { method: "DELETE" }), ctx("d1"));
  assert.equal(lastData("item.removed").piece.startsWith("Olive overshirt"), true);
});

test("a piece the person labelled themselves is not treated as an AI correction", async () => {
  wipe();
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,image,status,ai_tagged) VALUES ('m1','Tee','Tops','Grey','#999999','b.jpg','active',0)");
  await itemRoute.PATCH(json({ category: "Outerwear" }, "PATCH"), ctx("m1"));
  assert.equal(kinds().includes("item.corrected"), false);
});

test("feedback, wears, outfits, looks, products and profile changes all teach the brain", async () => {
  wipe();
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,image,status) VALUES ('x1','Grey tee','Tops','Grey','#999','c.jpg','active'),('x2','Dark jeans','Bottoms','Navy','#223','d.jpg','active')");
  await feedbackRoute.POST(json({ itemIds: ["x1", "x2"], rating: -1, tags: ["Too plain"] }));
  assert.deepEqual(lastData("feedback").tags, ["Too plain"]);
  await wearsRoute.POST(json({ date: "2026-11-01", itemIds: ["x1", "x2"] }));
  assert.equal(lastData("wear").pieces.length, 2);
  await outfitsRoute.POST(json({ name: "Casual", itemIds: ["x1", "x2"] }));
  assert.equal(lastData("outfit.saved").name, "Casual");
  const look = await (await looksRoute.POST(json({ image: "look.jpg", sourceUrl: "https://www.pinterest.com/pin/1", note: "dinner" }))).json();
  assert.equal(lastData("look.added").source, "pinterest.com");
  await lookRoute.PATCH(json({ pieces: [{ id: "p1", name: "Olive overshirt", category: "Outerwear", colorName: "Olive", colorHex: "#5a6b4a", pattern: "solid", fit: "relaxed", query: "q", want: "got" }] }, "PATCH"), ctx(look.id));
  assert.deepEqual(lastData("piece.want"), { name: "Olive overshirt", want: "got" });
  db.run("INSERT INTO products (id,title,merchant,url,saved,price) VALUES ('pr1','Olive overshirt','Shop','https://x.example/p',0,2999)");
  await productRoute.PATCH(json({ saved: true }, "PATCH"), ctx("pr1"));
  assert.equal(lastData("product.saved").merchant, "Shop");
  await profileRoute.PUT(json({ grooming: { saved: [{ kind: "hair", id: "quiff" }] }, avatar: { look: "photo" }, face: { shape: "round", overridden: true, auto: { shape: "oval", confidence: 0.6, alternatives: [] } } }, "PUT"));
  assert.equal(lastData("style.saved").name, "Quiff / pompadour");
  assert.equal(lastData("avatar.look").look, "photo");
  assert.deepEqual(lastData("face.corrected"), { from: "oval", to: "round" });
  await profileRoute.PUT(json({ grooming: { saved: [] }, avatar: { look: "photo" }, face: { shape: "round", overridden: true, auto: { shape: "oval", confidence: 0.6, alternatives: [] } } }, "PUT"));
  assert.ok(kinds().includes("style.unsaved"));
});

test("switching learning off records nothing", () => {
  wipe();
  settings.writeSettings({ brainLearn: false });
  events.note("feedback", { rating: 1 });
  assert.equal(kinds().length, 0);
  assert.equal(context.brainContext("advice").includes("Feedback"), false);
  settings.writeSettings({});
});

test("the context block summarises the closet and what was learned, and tag prompts get the corrections", () => {
  wipe();
  db.run("DELETE FROM items");
  db.run("INSERT INTO items (id,name,category,color_name,color_hex,image,status) VALUES ('c1','A','Tops','Navy','#223','e.jpg','active'),('c2','B','Tops','Navy','#223','f.jpg','active'),('c3','C','Outerwear','Olive','#5a6b4a','g.jpg','active')");
  events.note("item.corrected", { name: "Cream knit", changes: [{ field: "category", from: "Tops", to: "Outerwear" }] });
  db.run("INSERT INTO brain_memory (id,data,events_seen) VALUES (1,?,1)", JSON.stringify(MEMORY));
  const tag = context.brainContext("tag");
  assert.match(tag, /Closet: 3 pieces \(Tops x2, Outerwear\)/);
  assert.match(tag, /Common colours: navy x2, olive/);
  assert.match(tag, /category "Tops" -> "Outerwear"/);
  assert.match(tag, /Learned: Likes earthy layers/);
  assert.match(tag, /Rules for this person: Suggest a layer over tees/);
  assert.match(tag, /Naming hints: overshirt = Outerwear/);
  const advice = context.brainContext("advice");
  assert.doesNotMatch(advice, /category "Tops" -> "Outerwear"/, "corrections only matter when tagging");
  assert.match(advice, /Likes: olive; overshirts/);
});

test("the brain refreshes its own notes after enough activity, using the cheap reading model, and not before", async () => {
  wipe();
  settings.writeSettings({ geminiKey: "AIzaTEST" });
  seen.length = 0;
  for (let i = 0; i < 5; i++) events.note("feedback", { rating: 1, pieces: [`Tee ${i}`] });
  assert.equal(await reflect.maybeReflect(), null, "too few new events");
  assert.equal(seen.length, 0);
  seen.length = 0;
  // the 12th event tips it over: the brain refreshes itself in the background, without anyone asking
  for (let i = 0; i < 8; i++) events.note("wear", { pieces: [`Tee ${i}`] });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(seen.length, 1, "one automatic refresh");
  assert.match(seen[0].url, /gemini-3\.5-flash-lite/);
  const prompt = seen[0].body.contents[0].parts.map((p: { text?: string }) => p.text).join(" ");
  assert.match(prompt, /RECENT ACTIVITY/);
  assert.match(prompt, /feedback:/);
  assert.doesNotMatch(prompt, /APP MEMORY/, "the brain does not feed its own notes into itself while writing them");
  const stored = context.readMemory();
  assert.ok(stored.summary.includes("earthy"));
  assert.ok(stored.eventsSeen >= 12);
  assert.deepEqual(stored.likes, ["olive", "overshirts"]);
  // nothing new → no second call
  seen.length = 0;
  assert.equal(await reflect.maybeReflect(), null);
  assert.equal(seen.length, 0);
});

test("the brain page can refresh, pause and forget", async () => {
  wipe();
  settings.writeSettings({ geminiKey: "AIzaTEST" });
  events.note("feedback", { rating: 1, pieces: ["Tee"] });
  await new Promise((r) => setTimeout(r, 50));
  let s = await (await brainRoute.POST(json({ action: "reflect" }))).json();
  assert.ok(s.memory.summary);
  assert.equal(s.events, 1);
  s = await (await brainRoute.POST(json({ action: "toggle", enabled: false }))).json();
  assert.equal(s.enabled, false);
  s = await (await brainRoute.POST(json({ action: "toggle", enabled: true }))).json();
  assert.equal(s.enabled, true);
  s = await (await brainRoute.POST(json({ action: "forget" }))).json();
  assert.equal(s.events, 0);
  assert.equal(s.memory, null);
  assert.equal((await brainRoute.POST(json({ action: "nope" }))).status, 400);
  settings.writeSettings({});
  assert.equal((await brainRoute.POST(json({ action: "reflect" }))).status, 400, "needs an AI key");
});

test("every AI call starts with who the person is, from what their photos and answers established", () => {
  wipe();
  db.run("DELETE FROM profile");
  db.run("INSERT INTO profile (id,data) VALUES (1,?)", JSON.stringify({
    basics: { height: 181, weight: 58, direction: "Menswear", fit: "Relaxed", aims: [], goals: [] },
    body: { shoulderHip: "balanced", torsoLeg: "longer-legs", waist: null, source: "photo" },
    face: { shape: "round", auto: { shape: "round", confidence: 0.7, alternatives: [] }, overridden: false, wearsGlasses: true },
    grooming: { hairType: "wavy", density: "thick", receding: false, facialHair: true, saved: [] },
    avatar: { skin: "#c68e6a" },
  }));
  for (const feature of ["tag", "split", "look", "advice"]) {
    const c = context.brainContext(feature);
    assert.match(c, /About this person: style direction Menswear; 181 cm \(average\); lean build; proportions: balanced, longer-legs; round face, wears glasses; wavy thick hair/);
    assert.match(c, /Read from their body and face photos; stay consistent with it/);
  }
  settings.writeSettings({ brainLearn: false });
  assert.match(context.brainContext("advice"), /About this person/, "the person's own profile is shared even when learning is paused");
  settings.writeSettings({});
});
