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
  const which = refs.body && refs.face ? "Image 1 is a full-body photo and image 2 is a face photo of the same real person." : refs.body ? "The image is a full-body photo of one real person." : "The image is a face photo of one real person.";
  return [
    which,
    "TASK: create a new photo-realistic, full-body, front-facing image of THIS SAME PERSON standing naturally and relaxed, arms slightly away from the body, feet visible, on a plain light-grey studio background with even soft lighting.",
    "IDENTITY IS THE TOP PRIORITY. The result must be instantly recognisable as the person in the reference photos: same face shape, eyes, eyebrows, nose, mouth, ears, hairline and hairstyle, hair colour and texture, skin tone and undertone, facial hair, glasses if worn, freckles or marks. Do not beautify, de-age, change ethnicity, or give a generic model face.",
    "PHYSIQUE MUST BE CLEARLY VISIBLE and true to life: dress them in plain, well-fitted (not baggy) clothes, a plain white fitted t-shirt and plain grey slim trousers, so shoulders, chest, waist, hips, arms, torso length and leg length can be read. Keep their real build and proportions exactly: do not make them slimmer, more muscular, taller, shorter or more idealised, and keep the shoulder-to-hip balance and torso-to-leg ratio of the reference.",
    refs.body ? "Use the full-body photo for body shape and the face photo (if given) for facial detail." : "Only a face photo is available, so keep the body in line with the known proportions below rather than inventing an athletic or model body.",
    proportionSentence(p),
    "Output only the image, no text, borders or watermark.",
  ].filter(Boolean).join(" ");
}
