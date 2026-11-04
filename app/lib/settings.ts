import fs from "node:fs";
import path from "node:path";
export const DATA_DIR = process.env.CAPSULE_DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");

export type Usage = { calls: number; inTok: number; outTok: number; byModel: Record<string, number> };
export type Settings = {
  geminiKey?: string;
  openaiKey?: string;
  /** which AI service to use when both keys are saved */
  aiProvider?: "gemini" | "openai";
  aiQuality?: "economy" | "better";
  aiUsage?: Record<string, Usage>;
  /** the AI brain learns from how the app is used; on unless switched off */
  brainLearn?: boolean;
  serpApiKey?: string;
  country?: string;
  pin?: { salt: string; hash: string };
  sessionSecret?: string;
};

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

export const serpKey = () => process.env.SERPAPI_KEY || readSettings().serpApiKey || "";
export const countryCode = () => process.env.CAPSULE_COUNTRY || readSettings().country || "IN";
export const geminiKey = () => process.env.GEMINI_API_KEY || readSettings().geminiKey || "";
export const openaiKey = () => process.env.OPENAI_API_KEY || readSettings().openaiKey || "";
export const brainLearns = () => readSettings().brainLearn !== false;
