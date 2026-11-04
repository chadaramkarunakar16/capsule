import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

process.env.CAPSULE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-photos-"));
for (const k of ["GEMINI_API_KEY", "OPENAI_API_KEY"]) delete process.env[k];

type Seen = { url: string; raw: string; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const seen: Seen[] = [];
let textReply: unknown = {};
let server: http.Server;
/* eslint-disable @typescript-eslint/no-explicit-any */
let analyse: any, tryon: any, cutout: any, glasses: any, avatar: any, db: any, settings: any, apply: any, ana: any;
/* eslint-enable @typescript-eslint/no-explicit-any */
let jpegUri: string;

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const isJson = (req.headers["content-type"] ?? "").includes("json");
      seen.push({ url: req.url!, raw, body: isJson ? JSON.parse(raw) : {} });
      res.setHeader("content-type", "application/json");
      if (req.url!.includes("-image:") || req.url === "/v1/images/edits") {
        const b64 = Buffer.from("PIC").toString("base64");
        return res.end(JSON.stringify(req.url === "/v1/images/edits" ? { data: [{ b64_json: b64 }] } : { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: b64 } }] } }] }));
      }
      if (req.url === "/v1/responses") return res.end(JSON.stringify({ output_text: JSON.stringify(textReply) }));
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(textReply) }] } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.GEMINI_BASE_URL = base;
  process.env.OPENAI_BASE_URL = base;
  jpegUri = `data:image/jpeg;base64,${(await sharp({ create: { width: 400, height: 600, channels: 3, background: "#bbbbbb" } }).jpeg().toBuffer()).toString("base64")}`;
  db = await import("../lib/db");
  settings = await import("../lib/settings");
  analyse = await import("../app/api/analyse/route");
  tryon = await import("../app/api/tryon/route");
  cutout = await import("../app/api/cutout/route");
  glasses = await import("../app/api/glasses/route");
  avatar = await import("../app/api/avatar/generate/route");
  apply = await import("../lib/style/apply");
  ana = await import("../lib/analyse");
});
after(() => server.close());

const post = (route: any, body: unknown) => route.POST(new Request("http://x/", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })); // eslint-disable-line @typescript-eslint/no-explicit-any
const prompt = (s: Seen) => (s.body.contents?.[0]?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join(" ");

test("without a key every photo feature says it needs one, and nothing is called", async () => {
  seen.length = 0;
  for (const [route, body] of [[analyse, { kind: "face", image: jpegUri }], [tryon, { person: jpegUri, garments: [{ image: jpegUri, category: "Tops" }] }], [cutout, { image: "a.jpg" }], [glasses, { photo: jpegUri, frame: "round" }], [avatar, { photo: "a.jpg" }]] as const) {
    assert.equal((await (await post(route, body)).json()).available, false);
  }
  assert.equal(seen.length, 0);
});

test("face analysis: the AI's answer is validated into face shape, colours, hair details", async () => {
  settings.writeSettings({ geminiKey: "AIzaTEST" });
  textReply = { faceDetected: true, faceShape: "heart", confidence: 1.7, alternatives: ["heart", "oval", "banana", "diamond"], skin: "#C68E6A", hair: "not-a-colour", eyes: "#3b2a20", hairType: "wavy", hairDensity: "thick", receding: false, wearsGlasses: true, facialHair: "stubble", lighting: "good", notes: "n" };
  seen.length = 0;
  const r = await (await post(analyse, { kind: "face", image: jpegUri })).json();
  assert.equal(r.ok, true);
  assert.equal(r.shape, "heart");
  assert.equal(r.confidence, 1, "clamped");
  assert.deepEqual(r.alternatives, ["oval", "diamond"], "no duplicates of the main shape, no invented shapes");
  assert.equal(r.skin, "#c68e6a");
  assert.equal(r.hair, null, "a bad colour is dropped, not trusted");
  assert.equal(r.hairType, "wavy");
  assert.match(seen[0].url, /gemini-3\.5-flash-lite/);
  assert.match(prompt(seen[0]), /never comment on attractiveness/);
  assert.doesNotMatch(prompt(seen[0]), /APP MEMORY/);
});

test("face analysis: no face is reported kindly; bad requests are refused", async () => {
  textReply = { faceDetected: false, reason: "Two faces in the picture" };
  const r = await (await post(analyse, { kind: "face", image: jpegUri })).json();
  assert.deepEqual([r.ok, r.reason], [false, "Two faces in the picture"]);
  assert.equal((await post(analyse, { kind: "face", image: "nope" })).status, 400);
  assert.equal((await post(analyse, { kind: "weird", image: jpegUri })).status, 400);
});

test("body analysis: proportions, a build estimate and caveats", async () => {
  textReply = { bodyDetected: true, shoulderHip: "broader-shoulders", torsoLeg: "banana", waist: "straight", buildEstimate: -3, problems: ["feet cropped", "baggy top", "angled", "extra"], notes: "n" };
  const r = await (await post(analyse, { kind: "body", image: jpegUri })).json();
  assert.equal(r.shoulderHip, "broader-shoulders");
  assert.equal(r.torsoLeg, null);
  assert.equal(r.buildEstimate, -1);
  assert.equal(r.problems.length, 3);
});

test("applying a face read fills the shared profile without overwriting choices", async () => {
  const { EMPTY_PROFILE, normalizeProfile } = await import("../lib/style/profile");
  const face = { available: true, ok: true, shape: "round", confidence: 0.7, alternatives: ["oval"], skin: "#c68e6a", hair: "#2a1c14", eyes: "#3b2a20", hairType: "curly", hairDensity: "medium", receding: false, wearsGlasses: true, facialHair: "beard", lighting: "good", notes: "" };
  const a = apply.applyFacePhoto(normalizeProfile(EMPTY_PROFILE), face);
  assert.equal(a.profile.face.shape, "round");
  assert.equal(a.profile.face.wearsGlasses, true);
  assert.equal(a.profile.avatar.skin, "#c68e6a");
  assert.equal(a.profile.grooming.hairType, "curly");
  assert.equal(a.profile.grooming.facialHair, true);
  assert.ok(a.profile.color.season, "a first colour estimate comes from the AI-read colours");
  const chosen = normalizeProfile({ face: { shape: "square", overridden: true, auto: null, wearsGlasses: false }, grooming: { hairType: "straight" } as never });
  const b = apply.applyFacePhoto(chosen, face);
  assert.equal(b.profile.face.shape, "square", "the person's own choice stays");
  assert.equal(b.profile.grooming.hairType, "straight");
  const body = apply.applyBodyPhoto(normalizeProfile(EMPTY_PROFILE), { available: true, ok: true, shoulderHip: "balanced", torsoLeg: "longer-legs", waist: "straight", buildEstimate: -0.62, problems: [], notes: "" });
  assert.equal(body.profile.body.torsoLeg, "longer-legs");
  assert.equal(body.profile.avatar.build, -0.6, "build is estimated only when nothing else says");
  const withWeight = apply.applyBodyPhoto(normalizeProfile({ basics: { weight: 70, height: 175, direction: "", fit: "", aims: [], goals: [] } as never }), { available: true, ok: true, shoulderHip: null, torsoLeg: null, waist: null, buildEstimate: -0.9, problems: [], notes: "" });
  assert.equal(withWeight.profile.avatar.build, null);
  assert.equal(typeof ana.samplesOf, "function");
});

test("try-on on Gemini Economy: two garments per call, bottoms before tops, result saved", async () => {
  seen.length = 0;
  const g = (category: string) => ({ image: jpegUri, category });
  const r = await (await post(tryon, { person: jpegUri, garments: [g("Tops"), g("Bottoms"), g("Outerwear")] })).json();
  assert.equal(r.available, true);
  assert.equal(r.steps, 2);
  assert.equal(seen.length, 2);
  assert.match(seen[0].url, /gemini-2\.5-flash-image/);
  assert.match(prompt(seen[0]), /Image 2 is a bottoms garment\. Image 3 is a tops garment/);
  assert.match(prompt(seen[1]), /Image 2 is a outerwear garment/);
  assert.equal(seen[0].body.contents[0].parts.length, 4, "person + 2 garments + instruction");
  assert.ok(fs.existsSync(path.join(db.UPLOAD_DIR, r.image)));
  assert.equal((await post(tryon, { person: jpegUri, garments: [g("Shoes")] })).status, 400);
});

test("try-on on OpenAI: three garments per call through the image edit endpoint", async () => {
  settings.writeSettings({ openaiKey: "sk-test" });
  seen.length = 0;
  const g = (category: string) => ({ image: jpegUri, category });
  const r = await (await post(tryon, { person: jpegUri, garments: [g("Tops"), g("Bottoms"), g("Outerwear")] })).json();
  assert.equal(r.steps, 1);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "/v1/images/edits");
  assert.equal((seen[0].raw.match(/name="image\[\]"/g) ?? []).length, 4);
  assert.match(seen[0].raw, /gpt-image-2\.5-flare/);
});

test("glasses and cut-outs use the picture-editing model, save the result and do not keep the person's photo", async () => {
  settings.writeSettings({ geminiKey: "AIzaTEST" });
  fs.writeFileSync(path.join(db.UPLOAD_DIR, "piece.jpg"), Buffer.from(jpegUri.split(",")[1], "base64"));
  seen.length = 0;
  const g = await (await post(glasses, { photo: jpegUri, frame: "round", colour: "Tortoise" })).json();
  assert.match(prompt(seen[0]), /round eyeglasses in Tortoise/);
  assert.match(seen[0].url, /gemini-2\.5-flash-image/);
  assert.ok(g.image.endsWith("-glasses.png"));
  const c = await (await post(cutout, { image: "piece.jpg" })).json();
  assert.match(prompt(seen[1]), /isolated on a plain, flat, light warm-grey/);
  assert.ok(c.image.endsWith("-cut.png"));
  assert.equal((await post(glasses, { photo: jpegUri, frame: "nope" })).status, 400);
  assert.equal((await post(cutout, { image: "../etc/passwd" })).status, 400);
  const stored = fs.readdirSync(db.UPLOAD_DIR);
  assert.ok(!stored.some((f) => f === "photo.jpg"), "the person's own photo is never written to disk");
});

test("the picture of you always uses the identity model, with the saved photos as references", async () => {
  fs.writeFileSync(path.join(db.UPLOAD_DIR, "me.jpg"), Buffer.from(jpegUri.split(",")[1], "base64"));
  fs.writeFileSync(path.join(db.UPLOAD_DIR, "face.jpg"), Buffer.from(jpegUri.split(",")[1], "base64"));
  seen.length = 0;
  const r = await (await post(avatar, { photo: "me.jpg", facePhoto: "face.jpg" })).json();
  assert.match(seen[0].url, /gemini-3\.1-flash-image/);
  assert.equal(seen[0].body.contents[0].parts.length, 3, "two photos + the instruction");
  assert.match(prompt(seen[0]), /IDENTITY IS THE TOP PRIORITY/);
  assert.ok(r.image.endsWith("-avatar.png"));
  assert.equal((await post(avatar, {})).status, 400);
});

test("outfit photos are broken into every garment: the prompt demands top, bottom and shoes separately", async () => {
  const split = await import("../app/api/split/route");
  fs.writeFileSync(path.join(db.UPLOAD_DIR, "outfit.jpg"), Buffer.from(jpegUri.split(",")[1], "base64"));
  textReply = { pieces: [
    { name: "Olive overshirt", category: "Outerwear", box: [200, 150, 800, 520] },
    { name: "White tee", category: "Tops", box: [250, 200, 750, 480] },
    { name: "Dark jeans", category: "Bottoms", box: [250, 480, 750, 900] },
    { name: "White sneakers", category: "Shoes", box: [280, 900, 700, 990] },
    { name: "Speck", category: "Tops", box: [10, 10, 20, 20] },
  ] };
  seen.length = 0;
  const r = await (await post(split, { image: "outfit.jpg" })).json();
  assert.deepEqual(r.pieces.map((p: { name: string }) => p.name), ["Olive overshirt", "White tee", "Dark jeans", "White sneakers"], "four separate pieces, the tiny speck is dropped");
  const t = prompt(seen[0]);
  assert.match(t, /MUST produce at least two entries/);
  assert.match(t, /never skip the bottoms or the shoes/);
  assert.match(t, /Never merge several garments into one entry/);
});
