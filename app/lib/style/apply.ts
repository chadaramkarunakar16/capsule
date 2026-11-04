// One place where a photo's results are written into the profile, so the style questions, "My avatar"
// and the face screens all read and update the same data.
import type { BodyResult, FaceResult } from "../vision";
import { combine, readPhoto } from "./analysis";
import { classifyFace } from "./face";
import type { Profile } from "./profile";

type FaceOk = Extract<FaceResult, { ok: true }>;
type BodyOk = Extract<BodyResult, { ok: true }>;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** A face photo fills in face shape, skin and hair colour for the avatar, and a first colour season if there is none yet. */
export function applyFacePhoto(p: Profile, r: FaceOk): { profile: Profile; notes: string[] } {
  const notes: string[] = [];
  let face = p.face;
  if (r.ratios) {
    const g = classifyFace(r.ratios);
    face = { ...face, auto: { shape: g.shape, confidence: g.confidence, alternatives: g.alternatives }, shape: face.overridden && face.shape ? face.shape : g.shape };
    notes.push(`Face shape: ${g.shape} (${pct(g.confidence)} sure — a photo is only a rough guide, change it below if it feels wrong).`);
  } else {
    notes.push("Couldn’t measure the face outline in this photo, so face shape is unchanged.");
  }
  const avatar = { ...p.avatar, skin: r.swatches.skin, hair: r.swatches.hair ?? p.avatar.hair };
  notes.push(r.swatches.hair ? "Skin tone and hair colour were set on your avatar." : "Skin tone was set on your avatar (hair colour wasn’t clear — pick it below).");
  let color = { ...p.color, photos: Math.min(3, p.color.photos + 1) };
  if (!p.color.season && !p.color.overridden) {
    const c = combine([readPhoto(r.samples)], p.color.quiz);
    if (c) {
      color = { ...color, season: c.key, auto: { key: c.key, confidence: c.confidence, alternatives: c.alternatives } };
      notes.push(`First colour estimate: ${c.name} (${pct(c.confidence)} sure). Add more photos or the quiz under Colour to firm it up.`);
    }
  }
  return { profile: { ...p, face, avatar, color }, notes };
}

/** A full-body photo fills in shoulders-vs-hips and torso-vs-legs. */
export function applyBodyPhoto(p: Profile, r: BodyOk): { profile: Profile; notes: string[] } {
  const notes = ["Proportions estimated from your photo. Camera angle and clothing affect this — check the result and adjust if needed.", ...r.problems];
  return { profile: { ...p, body: { ...p.body, shoulderHip: r.body.shoulderHip, torsoLeg: r.body.torsoLeg, source: "photo", ratios: r.body.ratios } }, notes };
}
