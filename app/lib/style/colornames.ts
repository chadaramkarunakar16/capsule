// Colour words ↔ hex, used to read colours out of product titles and to name colours.
import { deltaE, hexToLab } from "./color";

export const COLOUR_WORDS: Record<string, string> = {
  white: "#f4f2ee", ivory: "#f1ead8", cream: "#ede3d0", beige: "#d6c3a3", sand: "#d8c7a5", camel: "#b88a5b", tan: "#a9744a", khaki: "#b9a57c", taupe: "#9a8a7b",
  brown: "#5a3a28", chocolate: "#4a2f22", coffee: "#5b4033", black: "#1b1b1d", charcoal: "#3a3b3e", grey: "#8a8d91", gray: "#8a8d91", silver: "#c4c6c9",
  navy: "#26324d", indigo: "#2d3a55", denim: "#4a6384", blue: "#2f5fa8", "light blue": "#a9c1de", sky: "#a9c1de", teal: "#2a6a6a", turquoise: "#2bb3a3", aqua: "#46d2d2",
  green: "#3e7b52", olive: "#6b6b3a", sage: "#9aa888", mint: "#a6d19a", emerald: "#0b8f6b", forest: "#2e5a3a", lime: "#8bc34a",
  yellow: "#e2b93b", mustard: "#c79a2c", gold: "#c9a24a", orange: "#e07b2e", rust: "#b4552d", terracotta: "#c0643e", copper: "#b0623a", coral: "#f26b5b", salmon: "#f0907a",
  red: "#b3382c", maroon: "#6e1f2a", burgundy: "#6a1b3a", wine: "#6a1b3a", pink: "#e5a0b0", blush: "#e8c0c0", fuchsia: "#d6197a", magenta: "#c2187a",
  purple: "#6b4a8a", lavender: "#b7a6d6", lilac: "#c3a8d8", plum: "#5a2a4a",
};

const WORDS = Object.keys(COLOUR_WORDS).sort((a, b) => b.length - a.length); // longest first: "light blue" before "blue"

/** First colour word found in free text (e.g. a product title), with its hex. */
export function colourFromText(text: string): { word: string; hex: string } | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z ]+/g, " ")} `;
  for (const w of WORDS) if (t.includes(` ${w} `)) return { word: w, hex: COLOUR_WORDS[w] };
  return null;
}

/** Every colour word in the text ("Olive Green" → olive, green). */
export function coloursInText(text: string): { word: string; hex: string }[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z ]+/g, " ")} `;
  const out: { word: string; hex: string }[] = [];
  let rest = t;
  for (const w of WORDS) if (rest.includes(` ${w} `)) { out.push({ word: w, hex: COLOUR_WORDS[w] }); rest = rest.replace(` ${w} `, "  "); }
  return out;
}

export function nameColor(hex: string) {
  const lab = hexToLab(hex);
  let best = WORDS[0], bd = Infinity;
  for (const w of WORDS) {
    const d = deltaE(lab, hexToLab(COLOUR_WORDS[w]));
    if (d < bd) { bd = d; best = w; }
  }
  return best.replace(/^./, (c) => c.toUpperCase());
}
