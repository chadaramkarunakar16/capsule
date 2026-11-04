import { fail, ok } from "@/lib/db";
import { aiReady, askJSON } from "@/lib/ai";
import { FACE_SHAPES, type FaceShape } from "@/lib/style/face";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DATA_URI = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (list.includes(v as T) ? (v as T) : null);
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : null);
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

const FACE_PROMPT = `You are reading ONE face photo for a personal-styling app (face shape, colouring, hair). If there is no clear single face, reply {"faceDetected":false,"reason":"short reason"}.
Otherwise reply ONE JSON object:
{"faceDetected":true,"faceShape":"oval|round|square|oblong|heart|diamond","confidence":0-1,"alternatives":["up to 2 other shapes that are also plausible"],"skin":"#RRGGBB the true skin tone of cheeks and forehead, ignoring colour cast and shadows","hair":"#RRGGBB natural hair colour or null","eyes":"#RRGGBB iris colour or null","hairType":"straight|wavy|curly|coily|null","hairDensity":"thin|medium|thick|null","receding":true|false,"wearsGlasses":true|false,"facialHair":"none|stubble|moustache|beard","lighting":"good|ok|poor","notes":"one short sentence"}
Judge face shape from the outline: forehead width, cheekbone width, jaw width, and length versus width. Use a lower confidence when hair or angle hides the outline. Be neutral and factual; never comment on attractiveness.`;

const BODY_PROMPT = `You are reading ONE full-body photo for a personal-styling app (proportions for choosing fits). If there is no clear single standing person, reply {"bodyDetected":false,"reason":"short reason"}.
Otherwise reply ONE JSON object:
{"bodyDetected":true,"shoulderHip":"broader-shoulders|balanced|broader-hips","torsoLeg":"longer-torso|balanced|longer-legs","waist":"defined|straight|null","buildEstimate":-1 to 1 (-1 very slim, 0 average, 1 broad/fuller),"problems":["short notes if the photo limits accuracy, e.g. cropped feet, baggy clothes, angled stance"],"notes":"one short sentence"}
Judge from the visible silhouette. Clothing and camera angle affect this, so say so in "problems" when relevant. Be neutral and factual; never comment on attractiveness or weight in judgemental terms.`;

/** body: { kind: "face" | "body", image: dataURI } — the photo is read by the AI and not stored. */
export async function POST(req: Request) {
  if (!aiReady()) return ok({ available: false });
  const b = await req.json().catch(() => null);
  const m = typeof b?.image === "string" ? DATA_URI.exec(b.image) : null;
  if (!m || (b.kind !== "face" && b.kind !== "body")) return fail("kind (face | body) and a photo are required");
  if (b.image.length > 8_000_000) return fail("that photo is too large");
  try {
    const j = (await askJSON(b.kind, { image: new Uint8Array(Buffer.from(m[2], "base64")), mime: m[1], prompt: b.kind === "face" ? FACE_PROMPT : BODY_PROMPT, maxTokens: 450 })) as Record<string, unknown>;
    if (b.kind === "face") {
      if (j.faceDetected === false || !hex(j.skin)) return ok({ available: true, ok: false, reason: String(j.reason || "No clear face found. Try a front-facing photo with your whole face in the frame and good light.").slice(0, 200) });
      return ok({
        available: true, ok: true,
        shape: oneOf<FaceShape>(j.faceShape, FACE_SHAPES),
        confidence: num(j.confidence, 0, 1, 0.5),
        alternatives: (Array.isArray(j.alternatives) ? j.alternatives : []).map((x) => oneOf<FaceShape>(x, FACE_SHAPES)).filter((x): x is FaceShape => !!x && x !== j.faceShape).slice(0, 2),
        skin: hex(j.skin), hair: hex(j.hair), eyes: hex(j.eyes),
        hairType: oneOf(j.hairType, ["straight", "wavy", "curly", "coily"] as const),
        hairDensity: oneOf(j.hairDensity, ["thin", "medium", "thick"] as const),
        receding: j.receding === true,
        wearsGlasses: j.wearsGlasses === true,
        facialHair: oneOf(j.facialHair, ["none", "stubble", "moustache", "beard"] as const) ?? "none",
        lighting: oneOf(j.lighting, ["good", "ok", "poor"] as const) ?? "ok",
        notes: String(j.notes ?? "").slice(0, 200),
      });
    }
    if (j.bodyDetected === false) return ok({ available: true, ok: false, reason: String(j.reason || "No full body found. Stand fully in frame, facing the camera, with your feet visible.").slice(0, 200) });
    return ok({
      available: true, ok: true,
      shoulderHip: oneOf(j.shoulderHip, ["broader-shoulders", "balanced", "broader-hips"] as const),
      torsoLeg: oneOf(j.torsoLeg, ["longer-torso", "balanced", "longer-legs"] as const),
      waist: oneOf(j.waist, ["defined", "straight"] as const),
      buildEstimate: num(j.buildEstimate, -1, 1, 0),
      problems: (Array.isArray(j.problems) ? j.problems : []).map((x) => String(x).slice(0, 140)).filter(Boolean).slice(0, 3),
      notes: String(j.notes ?? "").slice(0, 200),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn’t read that photo", 502);
  }
}
