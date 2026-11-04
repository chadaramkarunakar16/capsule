import { fail, ok } from "@/lib/db";
import { countryCode, serpKey } from "@/lib/settings";
import { searchShopping } from "@/lib/shop/serpapi";
import { searchLinks } from "@/lib/shop/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Always returns plain store-search links; returns live results too when a SerpApi key is configured.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const query = String(b?.query ?? "").trim();
  if (!query) return fail("query required");
  const code = countryCode();
  const links = searchLinks(query, code);
  const key = serpKey();
  if (!key) return ok({ providerAvailable: false, candidates: [], links });
  try {
    return ok({ providerAvailable: true, candidates: await searchShopping(query, code, key, 24), links });
  } catch (e) {
    return ok({ providerAvailable: true, candidates: [], links, error: e instanceof Error ? e.message : "Search failed" });
  }
}
