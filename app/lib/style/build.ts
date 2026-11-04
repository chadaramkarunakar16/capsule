// Neutral descriptions of build and height, used only to choose what to suggest (layering, fabric weight, lengths).
import type { Profile } from "./profile";

export type BuildKey = "lean" | "average" | "fuller";
export type HeightBand = "shorter" | "average" | "taller";

/** From the avatar's build slider if the person set it, else from height and weight. Null when there is nothing to go on. */
export function buildOf(p: Profile): { key: BuildKey; source: string } | null {
  const b = p.avatar.build;
  if (b != null) return { key: b < -0.3 ? "lean" : b > 0.35 ? "fuller" : "average", source: "from the build you set on your avatar" };
  const h = p.basics.height, w = p.basics.weight;
  if (h && w && h > 100 && w > 25) {
    const bmi = w / ((h / 100) ** 2);
    return { key: bmi < 19 ? "lean" : bmi > 27 ? "fuller" : "average", source: `from your height and weight (BMI ${bmi.toFixed(1)}, used only to choose fits)` };
  }
  return null;
}

export function heightBand(h: number | null | undefined): HeightBand | null {
  if (!h || h < 100) return null;
  return h < 165 ? "shorter" : h > 182 ? "taller" : "average";
}
