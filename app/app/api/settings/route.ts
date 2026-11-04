import { fail, ok } from "@/lib/db";
import { aiProvider, aiReady, MODELS, quality } from "@/lib/ai";
import { TRYON_MODELS } from "@/lib/ai";
import { tryonProvider, anthropicKey, geminiKey, countryCode, fashnKey, readSettings, serpKey, tagModel, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const k = anthropicKey();
  const g = geminiKey();
  const month = new Date().toISOString().slice(0, 7);
  return ok({
    aiAvailable: aiReady(),
    aiProvider: aiProvider(),
    geminiHint: g ? `…${g.slice(-4)}` : null,
    geminiFromEnv: !!process.env.GEMINI_API_KEY,
    aiQuality: quality(),
    aiModels: MODELS,
    aiUsage: readSettings().aiUsage?.[month] ?? { calls: 0, inTok: 0, outTok: 0, byModel: {} },
    keyHint: k ? `…${k.slice(-4)}` : null,
    keyFromEnv: !!process.env.ANTHROPIC_API_KEY,
    model: tagModel(),
    country: countryCode(),
    shopAvailable: !!serpKey(),
    shopKeyHint: serpKey() ? `…${serpKey().slice(-4)}` : null,
    shopKeyFromEnv: !!process.env.SERPAPI_KEY,
    tryonAvailable: !!tryonProvider(),
    tryonProvider: tryonProvider(),
    tryonHasFashn: !!fashnKey(),
    tryonHasGemini: !!geminiKey(),
    tryonModel: TRYON_MODELS[quality()].model,
    tryonKeyHint: fashnKey() ? `…${fashnKey().slice(-4)}` : null,
    tryonKeyFromEnv: !!process.env.FASHN_API_KEY,
  });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad body");
  const s = readSettings();
  if (b.tryonProvider === "gemini" || b.tryonProvider === "fashn") s.tryonProvider = b.tryonProvider;
  if ("geminiKey" in b) s.geminiKey = String(b.geminiKey || "").trim() || undefined;
  if (b.aiQuality === "economy" || b.aiQuality === "better") s.aiQuality = b.aiQuality;
  if ("anthropicKey" in b) s.anthropicKey = String(b.anthropicKey || "").trim() || undefined;
  if ("serpApiKey" in b) s.serpApiKey = String(b.serpApiKey || "").trim() || undefined;
  if ("fashnKey" in b) s.fashnKey = String(b.fashnKey || "").trim() || undefined;
  if ("country" in b) s.country = String(b.country || "").trim().toUpperCase() || undefined;
  if ("model" in b) s.model = String(b.model || "").trim() || undefined;
  writeSettings(s);
  return ok({ ok: true });
}
