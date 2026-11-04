// Which model does which job. Four jobs, not one model per feature, so a provider only ever needs 3 models on Economy.
//
//   read      pull facts out of one photo or a short text (tag a piece, read a face, read a body, summarise activity)
//   think     reason over several things (split an outfit photo, read a look, stylist advice)
//   edit      change a photo (try-on, glasses on my photo, clean cut-out)
//   likeness  make a picture that must look like the person (the AI image of you)
//
// Prices (USD, Nov 2026, from each provider's pricing page; per 1M tokens input / output, images per image):
//   Gemini  gemini-3.5-flash-lite 0.30 / 2.50 · gemini-3.6-flash 0.75 / 3.75 (half price until 31 Dec 2026)
//           gemini-2.5-flash-image ≈ $0.039 · gemini-3.1-flash-image ≈ $0.067
//   OpenAI  gpt-6-luna 0.10 / 0.50 · gpt-6.1-terra 1.00 / 5.00
//           gpt-image-2.5-flare and gpt-image-2.5-sunburst: $8 image-in / $30 image-out per 1M tokens (≈ $0.04–0.05 per medium picture)
export type Provider = "gemini" | "openai";
export type Quality = "economy" | "better";
export type Feature = "tag" | "face" | "body" | "split" | "look" | "advice" | "brain";
export type TextTier = "read" | "think";
export type ImageTier = "edit" | "likeness";
export type Tier = TextTier | ImageTier;

export const TEXT_TIER: Record<Feature, TextTier> = { tag: "read", face: "read", body: "read", brain: "read", split: "think", look: "think", advice: "think" };

export const ROUTES: Record<Provider, Record<Quality, Record<Tier, string>>> = {
  gemini: {
    economy: { read: "gemini-3.5-flash-lite", think: "gemini-3.5-flash-lite", edit: "gemini-2.5-flash-image", likeness: "gemini-3.1-flash-image" },
    better: { read: "gemini-3.5-flash-lite", think: "gemini-3.6-flash", edit: "gemini-3.1-flash-image", likeness: "gemini-3.1-flash-image" },
  },
  openai: {
    economy: { read: "gpt-6-luna", think: "gpt-6-luna", edit: "gpt-image-2.5-flare", likeness: "gpt-image-2.5-sunburst" },
    better: { read: "gpt-6-luna", think: "gpt-6.1-terra", edit: "gpt-image-2.5-sunburst", likeness: "gpt-image-2.5-sunburst" },
  },
};

export const PROVIDER_NAME: Record<Provider, string> = { gemini: "Google Gemini", openai: "OpenAI" };

/** Garments per image-edit call: a few at a time keeps each call inside what the model handles well. */
export const GARMENTS_PER_CALL: Record<Provider, Record<Quality, number>> = { gemini: { economy: 2, better: 3 }, openai: { economy: 3, better: 3 } };

/** The longest side photos are shrunk to before sending, per feature (fewer bytes, same readable detail). */
export const LONGEST_SIDE: Record<Feature, number> = { tag: 768, face: 1024, body: 1280, split: 1280, look: 1280, advice: 1024, brain: 0 };
/** Single garments on a plain background need the least image detail. */
export const LOW_DETAIL: Set<Feature> = new Set(["tag"]);

/** Cheap but usable estimate of what a call costs, shown in the settings card (USD). */
export const APPROX_COST: Record<Provider, Record<Quality, Record<string, string>>> = {
  gemini: {
    economy: { text: "a fraction of a cent", edit: "≈ 4¢ per picture", likeness: "≈ 7¢ per picture" },
    better: { text: "≈ ½¢", edit: "≈ 7¢ per picture", likeness: "≈ 7¢ per picture" },
  },
  openai: {
    economy: { text: "a fraction of a cent", edit: "≈ 4–5¢ per picture", likeness: "≈ 5–6¢ per picture" },
    better: { text: "≈ ½¢", edit: "≈ 5–6¢ per picture", likeness: "≈ 5–6¢ per picture" },
  },
};
