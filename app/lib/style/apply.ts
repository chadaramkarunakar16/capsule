// One place where a photo's results are written into the profile, so the style questions, "My avatar"
// and the face screens all read and update the same data.
import type { BodyRead, FaceRead } from "../analyse";
import { combine, readPhoto } from "./analysis";
import { samplesOf } from "../analyse";
import type { Profile } from "./profile";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** A face photo fills in face shape, skin tone, hair colour and hair details, and a first colour season if there is none yet. */
export function applyFacePhoto(p: Profile, r: FaceRead): { profile: Profile; notes: string[] } {
  const notes: string[] = [];
  let face = p.face;
  if (r.shape) {
    face = { ...face, auto: { shape: r.shape, confidence: r.confidence, alternatives: r.alternatives }, shape: face.overridden && face.shape ? face.shape : r.shape, wearsGlasses: face.wearsGlasses || r.wearsGlasses };
    notes.push(`Face shape: ${r.shape} (${pct(r.confidence)} sure — a photo is only a rough guide, change it below if it feels wrong).`);
  } else {
    notes.push("Couldn’t judge the face outline in this photo, so face shape is unchanged.");
  }
  const avatar = { ...p.avatar, skin: r.skin, hair: r.hair ?? p.avatar.hair };
  notes.push(r.hair ? "Skin tone and hair colour were set on your avatar." : "Skin tone was set on your avatar (hair colour wasn’t clear — pick it below).");
  // hair details help the grooming suggestions; never overwrite what the person already chose
  const g = p.grooming;
  const grooming = { ...g, hairType: g.hairType ?? r.hairType, density: g.density ?? r.hairDensity, receding: g.receding || r.receding, facialHair: g.facialHair || r.facialHair === "beard" || r.facialHair === "stubble" };
  if (!g.hairType && r.hairType) notes.push(`Hair looks ${r.hairType}${r.hairDensity ? ` and ${r.hairDensity}` : ""} — used for hairstyle suggestions.`);
  if (r.lighting === "poor") notes.push("The lighting was poor, so colours may be off — daylight by a window works best.");
  let color = { ...p.color, photos: Math.min(3, p.color.photos + 1) };
  if (!p.color.season && !p.color.overridden) {
    const c = combine([readPhoto(samplesOf(r))], p.color.quiz);
    if (c) {
      color = { ...color, season: c.key, auto: { key: c.key, confidence: c.confidence, alternatives: c.alternatives } };
      notes.push(`First colour estimate: ${c.name} (${pct(c.confidence)} sure). Add more photos or the quiz under Colour to firm it up.`);
    }
  }
  return { profile: { ...p, face, avatar, grooming, color }, notes };
}

/** A full-body photo fills in shoulders-vs-hips, torso-vs-legs, waist and (if you haven't set it) build. */
export function applyBodyPhoto(p: Profile, r: BodyRead): { profile: Profile; notes: string[] } {
  const notes = ["Proportions read from your photo. Camera angle and clothing affect this — check the result and adjust if needed.", ...r.problems];
  const body = { ...p.body, shoulderHip: r.shoulderHip ?? p.body.shoulderHip, torsoLeg: r.torsoLeg ?? p.body.torsoLeg, waist: r.waist ?? p.body.waist, source: "photo" as const };
  // the build estimate only fills the avatar's build slider if nothing was set (height and weight, or the slider itself, win)
  const avatar = p.avatar.build == null && !p.basics.weight ? { ...p.avatar, build: Math.round(r.buildEstimate * 20) / 20 } : p.avatar;
  if (avatar !== p.avatar) notes.push("Build was estimated from the photo for your avatar; set your weight or the Build slider to override it.");
  return { profile: { ...p, body, avatar }, notes };
}
