// Google Shopping results via SerpApi (https://serpapi.com/google-shopping-api). Needs the user's own key.
import { country } from "./stores";
import type { Candidate } from "./types";

type Raw = {
  title?: string; source?: string; link?: string; product_link?: string; thumbnail?: string; price?: string; extracted_price?: number;
  old_price?: string; extracted_old_price?: number; rating?: number; reviews?: number; delivery?: string; second_hand_condition?: string; tag?: string;
};

const SYMBOL = /^[^\d\s]+/;

export function normalise(results: Raw[] | undefined, fallbackSymbol: string): Candidate[] {
  const out: Candidate[] = [];
  for (const r of results ?? []) {
    const url = r.link || r.product_link;
    if (!r.title || !url) continue;
    if (r.second_hand_condition) continue; // keep to new items
    const sym = r.price?.trim().match(SYMBOL)?.[0] ?? fallbackSymbol;
    out.push({
      title: r.title,
      merchant: r.source ?? "",
      url,
      imageUrl: r.thumbnail ?? "",
      price: typeof r.extracted_price === "number" ? r.extracted_price : null,
      oldPrice: typeof r.extracted_old_price === "number" ? r.extracted_old_price : null,
      currency: sym,
      rating: typeof r.rating === "number" ? r.rating : null,
      reviews: typeof r.reviews === "number" ? r.reviews : null,
      delivery: r.delivery ?? "",
      source: "serpapi",
      trust: { level: "unknown", label: "", notes: [] }, // filled in when ranked
    });
  }
  return out;
}

export async function searchShopping(query: string, countryCode: string, apiKey: string, limit = 20): Promise<Candidate[]> {
  const c = country(countryCode);
  const u = new URL("/search.json", process.env.SERPAPI_BASE_URL || "https://serpapi.com"); // base override is for tests
  u.searchParams.set("engine", "google_shopping");
  u.searchParams.set("q", query);
  u.searchParams.set("gl", c.gl === "uk" ? "gb" : c.gl);
  u.searchParams.set("hl", "en");
  u.searchParams.set("num", String(Math.min(40, limit)));
  u.searchParams.set("api_key", apiKey);
  const r = await fetch(u, { signal: AbortSignal.timeout(20_000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error ? `SerpApi: ${j.error}` : `SerpApi request failed (${r.status})`);
  return normalise(j.shopping_results, c.symbol).slice(0, limit);
}
