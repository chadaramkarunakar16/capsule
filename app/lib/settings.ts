import fs from "node:fs";
import path from "node:path";
export const DATA_DIR = process.env.CAPSULE_DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");

type Usage = { calls: number; inTok: number; outTok: number; byModel: Record<string, number> };
type Settings = { tryonProvider?: "gemini" | "fashn"; geminiKey?: string; aiQuality?: "economy" | "better"; aiUsage?: Record<string, Usage>; anthropicKey?: string; model?: string; serpApiKey?: string; country?: string; fashnKey?: string; pin?: { salt: string; hash: string }; sessionSecret?: string };

export function readSettings(): Settings {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}
export function writeSettings(s: Settings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
}
export function anthropicKey() {
  return process.env.ANTHROPIC_API_KEY || readSettings().anthropicKey || "";
}
export function tagModel() {
  return process.env.CAPSULE_TAG_MODEL || readSettings().model || "claude-haiku-5-5";
}

export function serpKey() {
  return process.env.SERPAPI_KEY || readSettings().serpApiKey || "";
}
export function countryCode() {
  return process.env.CAPSULE_COUNTRY || readSettings().country || "IN";
}
export function fashnKey() {
  return process.env.FASHN_API_KEY || readSettings().fashnKey || "";
}
export function geminiKey() {
  return process.env.GEMINI_API_KEY || readSettings().geminiKey || "";
}
/** Which service makes photo try-ons: the user's pick if its key exists, else Gemini (one key for everything), else FASHN. */
export function tryonProvider(): "gemini" | "fashn" | null {
  const pref = readSettings().tryonProvider;
  if (pref === "fashn" && fashnKey()) return "fashn";
  if (pref === "gemini" && geminiKey()) return "gemini";
  return geminiKey() ? "gemini" : fashnKey() ? "fashn" : null;
}
