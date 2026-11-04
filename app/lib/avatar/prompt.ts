// Instruction for the AI image of "you": faithful to the reference photos and to the proportions in the profile,
// deliberately plain (neutral clothes, plain background) so it works as a base for judging fit.
import { LABELS } from "../style/body";
import type { Profile } from "../style/profile";

export function proportionSentence(p: Profile): string {
  const bits: string[] = [];
  if (p.basics.height) bits.push(`about ${p.basics.height} cm tall`);
  if (p.body.shoulderHip) bits.push(LABELS.shoulderHip[p.body.shoulderHip].toLowerCase());
  if (p.body.torsoLeg) bits.push(LABELS.torsoLeg[p.body.torsoLeg].toLowerCase());
  if (p.body.waist) bits.push(LABELS.waist[p.body.waist].toLowerCase());
  return bits.length ? `Known proportions: ${bits.join("; ")}.` : "";
}

export function avatarPrompt(p: Profile, refs: { body: boolean; face: boolean }): string {
  const which = refs.body && refs.face ? "Image 1 is a full-body photo and image 2 is a face photo of the same person." : refs.body ? "The image is a full-body photo of one person." : "The image is a face photo of one person.";
  return [
    which,
    "Create a new photo-realistic, full-body, front-facing image of this same real person standing naturally with arms slightly away from the body, on a plain light-grey studio background, wearing simple fitted neutral clothes (a plain white t-shirt and plain grey trousers) and barefoot or in plain white sneakers.",
    "Keep the face, hair, skin tone and overall build faithful to the reference. The body must match the real person's proportions: do not make them slimmer, more muscular, taller, or more idealised than they are, and keep shoulder-to-hip balance and torso-to-leg ratio as in the reference.",
    proportionSentence(p),
    "Output only the image, no text or watermark.",
  ].filter(Boolean).join(" ");
}
