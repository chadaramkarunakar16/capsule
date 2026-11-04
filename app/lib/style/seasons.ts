import { deltaE, hexToLab, traits, type Lab } from "./color";

export type Axes = {
  /** −1 cool … +1 warm */ warmth: number;
  /** −1 light … +1 deep */ depth: number;
  /** −1 soft/muted … +1 clear/bright */ clarity: number;
};

export type Season = {
  key: string;
  name: string;
  family: "Spring" | "Summer" | "Autumn" | "Winter";
  blurb: string;
  axes: Axes;
  best: string[];
  neutrals: string[];
  avoid: string[];
};

const S = (key: string, name: string, family: Season["family"], blurb: string, w: number, d: number, c: number, best: string[], neutrals: string[], avoid: string[]): Season => ({
  key, name, family, blurb, axes: { warmth: w, depth: d, clarity: c }, best, neutrals, avoid,
});

export const SEASONS: Season[] = [
  S("light-spring", "Light Spring", "Spring", "Warm, light and delicate. Fresh, soft-warm colours.", 0.5, -0.7, 0.1,
    ["#f6c28b", "#f4a58a", "#f2d16b", "#a6d19a", "#7fc8c0", "#8fb8e6", "#e8a0b8", "#c7b3e3"],
    ["#f3e6cf", "#d9c0a0", "#b8a68e", "#8a7b6a", "#5b6475"], ["#1b1b1d", "#5a0f2b", "#3a3a3a", "#0b2a5c"]),
  S("true-spring", "True Spring", "Spring", "Warm, clear and lively. Golden, juicy colours.", 0.8, -0.2, 0.5,
    ["#ff7f50", "#f6b73c", "#8bc34a", "#2bb3a3", "#f26b3a", "#e2495a", "#5aa9e6", "#f4a6b8"],
    ["#f3e3c3", "#c8a26b", "#8b6b3f", "#6b4a2b", "#3b5b7a"], ["#000000", "#6d6e71", "#7b2d5b", "#c9d3e6"]),
  S("bright-spring", "Bright Spring", "Spring", "Warm-leaning, high-contrast and vivid. Clear, saturated colours.", 0.4, -0.1, 0.9,
    ["#ff4f5a", "#ff9f1c", "#2ecc71", "#00b8d9", "#1e88e5", "#ff5fa2", "#ffd23f", "#7e57c2"],
    ["#fff8ec", "#d8c3a0", "#8a6f4d", "#2f3e5c", "#3b2a20"], ["#a39382", "#7d7461", "#b7a99a", "#8c7b75"]),
  S("light-summer", "Light Summer", "Summer", "Cool, light and gentle. Soft pastels with a cool cast.", -0.4, -0.7, -0.1,
    ["#e6a8c0", "#a8c4e8", "#9fd3c7", "#c8b6e6", "#f4c6d0", "#9fb7d9", "#f2dc9a", "#e8b4a8"],
    ["#f2f0f2", "#cfd3da", "#a9b0be", "#7b8599", "#5a6b8c"], ["#000000", "#e65100", "#8b4513", "#b8860b"]),
  S("true-summer", "True Summer", "Summer", "Cool, medium and soft-clear. Rosy, blue-based colours.", -0.8, -0.1, -0.3,
    ["#d86a9a", "#6f8fd6", "#4aa3a6", "#9b7bc8", "#c2587a", "#7fb2d9", "#5c7fa3", "#b86f9f"],
    ["#eceff4", "#b6bfcc", "#7f8aa0", "#4b5873", "#2f3b57"], ["#ff8c00", "#c8a165", "#8c5a2b", "#d4af37"]),
  S("soft-summer", "Soft Summer", "Summer", "Cool-neutral and muted. Dusty, blended colours.", -0.3, 0.0, -0.8,
    ["#b88aa3", "#8aa3b8", "#8fae9f", "#a89bc0", "#c49aa0", "#7f9aa6", "#b5a7a0", "#9aa7c0"],
    ["#e9e6e6", "#c0bbb9", "#8e8a8c", "#6a6a74", "#4a5565"], ["#ff6f00", "#00e5ff", "#ffd600", "#d50000"]),
  S("soft-autumn", "Soft Autumn", "Autumn", "Warm-neutral and muted. Earthy, softened colours.", 0.3, 0.1, -0.8,
    ["#b88a5b", "#6b6b3a", "#c28d6c", "#7d8a6b", "#d2a679", "#a56a4a", "#8a9a7b", "#c9a46a"],
    ["#ede3d0", "#cbb894", "#9a8a6b", "#6b5d4a", "#4f5a4a"], ["#000000", "#ff1493", "#00bfff", "#e0e0ff"]),
  S("true-autumn", "True Autumn", "Autumn", "Warm, rich and earthy. Spiced, golden colours.", 0.8, 0.3, -0.1,
    ["#b4552d", "#c8822f", "#6a8a3a", "#2f7a6a", "#a23b2a", "#d4a017", "#8a5a2b", "#cf6a32"],
    ["#f0e0c0", "#c7a46a", "#8a6a3a", "#5a3e26", "#3a4a3a"], ["#ff69b4", "#b0c4de", "#8888aa", "#00ffff"]),
  S("deep-autumn", "Deep Autumn", "Autumn", "Warm, deep and rich. Dark, glowing earth tones.", 0.5, 0.8, 0.1,
    ["#7a2e1d", "#a8431f", "#2e5a3a", "#8a6a1e", "#1f5f5b", "#b07a2a", "#6e1f2a", "#c25e2b"],
    ["#efe2c8", "#8a6a3e", "#5a3a22", "#2d2a20", "#1f3b2f"], ["#f4c6d8", "#b0d0f0", "#e6e6fa", "#f0f0f0"]),
  S("deep-winter", "Deep Winter", "Winter", "Cool, deep and strong. Dark, jewelled colours.", -0.4, 0.8, 0.2,
    ["#6a0f3a", "#0f4c75", "#1b5e4a", "#3b1f6b", "#b0123a", "#006d77", "#8e1b5b", "#1d3557"],
    ["#ffffff", "#c9ced6", "#5a6270", "#1b1b1d", "#14213d"], ["#f2c27b", "#d9a066", "#c8b88a", "#e8d5b0"]),
  S("true-winter", "True Winter", "Winter", "Cool, clear and high-contrast. Icy and saturated colours.", -0.8, 0.2, 0.4,
    ["#d6193a", "#1565c0", "#0b8f6b", "#7b2cbf", "#e91e8c", "#00a3c4", "#1a237e", "#ffffff"],
    ["#ffffff", "#d0d4dc", "#6b7280", "#111111", "#101a3a"], ["#d2a46a", "#a08060", "#c8a165", "#8a6a3a"]),
  S("bright-winter", "Bright Winter", "Winter", "Cool-leaning, very clear and vivid. Electric colours.", -0.5, 0.0, 0.9,
    ["#ff2e63", "#00b4d8", "#7c3aed", "#00c853", "#ff006e", "#2979ff", "#ffea00", "#00e5ff"],
    ["#ffffff", "#e0e3ea", "#2b2d42", "#000000", "#1e1e3f"], ["#a39382", "#8b7d6b", "#b8a99a", "#7d6e5a"]),
];

export const seasonByKey = (key: string | null | undefined) => SEASONS.find((s) => s.key === key) ?? null;

const W = { warmth: 1.6, depth: 1.0, clarity: 1.0 };
const dist = (a: Axes, b: Axes) =>
  Math.sqrt(W.warmth * (a.warmth - b.warmth) ** 2 + W.depth * (a.depth - b.depth) ** 2 + W.clarity * (a.clarity - b.clarity) ** 2);

export type SeasonGuess = { key: string; name: string; confidence: number; alternatives: { key: string; name: string }[] };

/** Nearest season to a point in (warmth, depth, clarity) space; confidence reflects the margin to the runner-up. */
export function classifySeason(axes: Axes, evidence = 1): SeasonGuess {
  const ranked = SEASONS.map((s) => ({ s, d: dist(axes, s.axes) })).sort((a, b) => a.d - b.d);
  const margin = ranked[1].d - ranked[0].d;
  // 0.50 when two seasons are a tie → ~0.90 when the best is clearly ahead; scaled down by weak evidence
  const raw = 0.5 + 0.4 * Math.tanh(margin * 4);
  const confidence = Math.round(Math.min(0.92, raw * (0.6 + 0.4 * evidence)) * 100) / 100;
  return {
    key: ranked[0].s.key,
    name: ranked[0].s.name,
    confidence,
    alternatives: ranked.slice(1, 3).map((r) => ({ key: r.s.key, name: r.s.name })),
  };
}

export type PaletteFit = { delta: number; text: string | null; zone: "core" | "near" | "off" | "avoid" | "unknown" };

/** How a single colour sits against a season palette. Positive = flattering. */
export function paletteFit(hex: string, season: Season | null): PaletteFit {
  if (!season) return { delta: 0, text: null, zone: "unknown" };
  const lab: Lab = hexToLab(hex);
  const min = (list: string[]) => Math.min(...list.map((c) => deltaE(lab, hexToLab(c))));
  const dBest = min(season.best), dNeutral = min(season.neutrals), dAvoid = min(season.avoid);
  const dCore = Math.min(dBest, dNeutral);
  const t = traits(hex);
  const warmSeason = season.axes.warmth > 0;

  if (dAvoid < 16 && dAvoid < dCore) {
    return { delta: -10, zone: "avoid", text: `This colour is one of the shades that tend to wash out or overpower ${season.name} colouring — keep it away from your face` };
  }
  if (dCore < 16) return { delta: 12, zone: "core", text: `Very close to a core ${season.name} colour` };
  if (dCore < 30) return { delta: 6, zone: "near", text: `Sits near your ${season.name} palette` };
  // far from every swatch: use temperature as the tie-breaker
  if (!t.neutral && Math.abs(t.warmth) > 0.25 && Math.sign(t.warmth) !== (warmSeason ? 1 : -1)) {
    return { delta: -6, zone: "off", text: `${warmSeason ? "Cooler" : "Warmer"} than your ${season.name} palette — try it lower down, away from your face` };
  }
  return { delta: 0, zone: "off", text: null };
}
