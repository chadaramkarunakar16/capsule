import { fail, ok } from "@/lib/db";
import { PROVIDER_NAME, ROUTES, aiReady, hasKey, provider, quality } from "@/lib/ai";
import { countryCode, geminiKey, openaiKey, readSettings, serpKey, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Keys are never sent back, not even part of one: only whether each is saved.
export async function GET() {
  const month = new Date().toISOString().slice(0, 7);
  const p = provider();
  return ok({
    aiAvailable: aiReady(),
    aiProvider: p,
    aiProviderName: p ? PROVIDER_NAME[p] : null,
    hasGemini: hasKey("gemini"),
    hasOpenai: hasKey("openai"),
    geminiFromEnv: !!process.env.GEMINI_API_KEY && !readSettings().geminiKey,
    openaiFromEnv: !!process.env.OPENAI_API_KEY && !readSettings().openaiKey,
    aiChoice: readSettings().aiProvider ?? null,
    aiQuality: quality(),
    aiRoutes: ROUTES,
    aiUsage: readSettings().aiUsage?.[month] ?? { calls: 0, inTok: 0, outTok: 0, byModel: {} },
    country: countryCode(),
    shopAvailable: !!serpKey(),
    shopKeyFromEnv: !!process.env.SERPAPI_KEY,
    // kept for older screens
    geminiHint: geminiKey() ? "saved" : null,
    openaiHint: openaiKey() ? "saved" : null,
  });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("bad body");
  const s = readSettings();
  if ("geminiKey" in b) s.geminiKey = String(b.geminiKey || "").trim() || undefined;
  if ("openaiKey" in b) s.openaiKey = String(b.openaiKey || "").trim() || undefined;
  if (b.aiProvider === "gemini" || b.aiProvider === "openai") s.aiProvider = b.aiProvider;
  if (b.aiQuality === "economy" || b.aiQuality === "better") s.aiQuality = b.aiQuality;
  if ("serpApiKey" in b) s.serpApiKey = String(b.serpApiKey || "").trim() || undefined;
  if ("country" in b) s.country = String(b.country || "").trim().toUpperCase() || undefined;
  writeSettings(s);
  return ok({ ok: true });
}
