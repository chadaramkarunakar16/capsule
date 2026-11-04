import { ESTABLISHED, MARKETPLACES } from "./stores";
import type { Trust } from "./types";

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

/**
 * Honest, heuristic trust signal for a merchant. It cannot detect fakes — it tells you how much homework to do.
 * `medianPrice` (of comparable results) lets it flag prices that look too good to be true.
 */
export function assessTrust(p: { merchant: string; url: string; price: number | null; rating: number | null; reviews: number | null }, medianPrice?: number | null): Trust {
  const m = p.merchant.toLowerCase();
  const h = host(p.url);
  const notes: string[] = [];
  const known = (list: string[]) => list.some((s) => m.includes(s) || h.includes(s.replace(/\s+/g, "")));

  let level: Trust["level"] = "unknown";
  if (known(MARKETPLACES)) { level = "marketplace"; notes.push("Marketplace: quality and authenticity depend on the individual seller — check seller ratings and the return policy."); }
  else if (known(ESTABLISHED)) { level = "established"; notes.push("Well-known retailer with a standard returns process."); }
  else { notes.push("Store not recognised — look for a returns policy, contact details and independent reviews before paying."); }

  if (p.url && !p.url.startsWith("https://")) { level = "caution"; notes.push("The link isn’t secure (no https)."); }
  if (medianPrice && p.price != null && p.price < medianPrice * 0.4) {
    if (level !== "established") level = "caution";
    notes.push("Priced far below similar items — a common sign of poor quality or a scam.");
  }
  if (p.rating != null && p.reviews != null) {
    if (p.reviews < 5) notes.push("Very few reviews, so the rating isn’t reliable yet.");
    else if (p.rating < 3.5) notes.push("Low average rating.");
  } else if (level === "unknown") notes.push("No reviews were found.");

  const label = { established: "Established retailer", marketplace: "Marketplace seller", unknown: "Unverified store", caution: "Be careful" }[level];
  return { level, label, notes };
}

export const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
