import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_PROFILE, normalizeProfile } from "../lib/style/profile";
import { colourFromText, nameColor } from "../lib/style/colornames";
import { assessTrust, median } from "../lib/shop/trust";
import { matchOwned, rankProducts, unlocks } from "../lib/shop/rank";
import { normalise } from "../lib/shop/serpapi";
import { assertPublicUrl, parseProductHtml } from "../lib/shop/page";
import { COUNTRIES, country, searchLinks } from "../lib/shop/stores";
import type { Candidate, Piece } from "../lib/shop/types";

const profile = normalizeProfile({ ...EMPTY_PROFILE, color: { ...EMPTY_PROFILE.color, season: "soft-autumn" } });
const piece = (o: Partial<Piece> = {}): Piece => ({ id: "p1", name: "Olive overshirt", category: "Outerwear", colorName: "Olive", colorHex: "#6b6b3a", pattern: "solid", fit: "regular", query: "olive green cotton overshirt men", ...o });
const cand = (o: Partial<Candidate> = {}): Candidate => ({ title: "Olive Green Cotton Overshirt", merchant: "Myntra", url: "https://www.myntra.com/x", imageUrl: "", price: 2000, oldPrice: null, currency: "₹", rating: 4.3, reviews: 120, delivery: "", source: "serpapi", trust: { level: "unknown", label: "", notes: [] }, ...o });

test("colours in text", () => {
  assert.equal(colourFromText("Men's Light Blue Oxford Shirt")?.word, "light blue");
  assert.equal(colourFromText("Rust ribbed tee")?.word, "rust");
  assert.equal(colourFromText("Plain shirt"), null);
  assert.equal(nameColor("#6b6b3a"), "Olive");
});

test("trust: retailers, marketplaces, unknown stores, too-good-to-be-true prices", () => {
  const base = { merchant: "Myntra", url: "https://www.myntra.com/a", price: 1000, rating: 4.2, reviews: 300 };
  assert.equal(assessTrust(base).level, "established");
  assert.equal(assessTrust({ ...base, merchant: "AliExpress", url: "https://aliexpress.com/x" }).level, "marketplace");
  assert.equal(assessTrust({ ...base, merchant: "TrendyDeals24", url: "https://trendydeals24.shop/x" }).level, "unknown");
  assert.equal(assessTrust({ ...base, merchant: "TrendyDeals24", url: "https://trendydeals24.shop/x", price: 200 }, 1500).level, "caution");
  assert.equal(assessTrust({ ...base, price: 200 }, 1500).level, "established", "a big retailer's sale price is not a scam signal on its own");
  assert.equal(assessTrust({ ...base, url: "http://shop.example/x", merchant: "Shop" }).level, "caution");
  assert.ok(assessTrust({ ...base, reviews: 2 }).notes.some((n) => /few reviews/.test(n)));
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([]), null);
});

test("owned-match: close colour and kind matches; wrong kind or colour does not", () => {
  const owned = [
    { id: "a", name: "Olive overshirt", category: "Outerwear", colorHex: "#6b6b3a", fit: "regular", pattern: "solid" },
    { id: "b", name: "Camel coat", category: "Outerwear", colorHex: "#b88a5b", fit: "regular", pattern: "solid" },
    { id: "c", name: "Olive tee", category: "Tops", colorHex: "#6b6b3a", fit: "regular", pattern: "solid" },
  ];
  assert.equal(matchOwned(piece(), owned)?.id, "a");
  assert.equal(matchOwned(piece({ colorHex: "#00e6e6", colorName: "Aqua", name: "Aqua jacket" }), owned), null);
  assert.equal(matchOwned(piece({ category: "Shoes" }), owned), null);
});

test("unlocks: counts good outfits the new piece would add", () => {
  const owned = [
    { category: "Bottoms", colorHex: "#2d3a55", fit: "straight", formality: 1 },
    { category: "Bottoms", colorHex: "#b9a57c", fit: "slim", formality: 2 },
    { category: "Tops", colorHex: "#ede3d0", fit: "regular", formality: 2 },
  ];
  const n = unlocks({ category: "Tops", colorHex: "#b4552d", fit: "fitted", formality: 1 }, owned, profile);
  assert.ok(n >= 1 && n <= 2, String(n));
  assert.equal(unlocks({ category: "Tops", colorHex: "#b4552d" }, [], profile), 0);
});

test("ranking: matching colour & words first, scams last, budget tier and cap", () => {
  const owned: never[] = [];
  const res = rankProducts([
    cand({ title: "Olive Green Cotton Overshirt", price: 2000 }),
    cand({ title: "Cheap Olive Overshirt Jacket", price: 1300, merchant: "Ajio", url: "https://www.ajio.com/x", rating: 4.5, reviews: 40 }),
    cand({ title: "Black Leather Jacket", price: 5000 }),
    cand({ title: "Olive Green Cotton Overshirt Premium", price: 2600, rating: 4.7, reviews: 900 }),
    cand({ title: "Olive Green Cotton Overshirt", price: 150, merchant: "ScamShop", url: "https://scam.shop/x", rating: null, reviews: null }),
  ], piece(), owned, profile);
  assert.equal(res.length, 5);
  assert.equal(res[0].tier, "best");
  assert.ok(res.findIndex((r) => r.title === "Black Leather Jacket") > 1, "wrong item sinks");
  const scam = res.find((r) => r.merchant === "ScamShop")!;
  assert.equal(scam.trust.level, "caution");
  assert.ok(res.indexOf(scam) >= 3, "caution items rank low");
  assert.ok(res.every((r) => r.trust.label));
  assert.ok(res.some((r) => r.tier === "budget"));
  assert.ok(res.filter((r) => r.trust.level === "caution").every((r) => r.tier === "similar"), "a flagged store is never labelled best or budget");
  assert.ok(rankProducts([cand({ price: 9000 }), cand({ price: 900 })], piece(), owned, profile, 1000).length === 1, "budget cap");
  const rust = rankProducts([cand({ title: "Rust Overshirt" })], piece({ colorName: "Rust", colorHex: "#b4552d", query: "rust overshirt" }), owned, profile)[0];
  assert.ok(rust.palette.delta > 0 && rust.palette.text, "palette fit comes from the product's colour");
});

test("SerpApi normalisation (documented shopping_results fields)", () => {
  const out = normalise([
    { title: "Olive Overshirt", source: "Myntra", link: "https://www.myntra.com/p", thumbnail: "https://t/x.jpg", price: "₹1,999.00", extracted_price: 1999, old_price: "₹2,999.00", extracted_old_price: 2999, rating: 4.4, reviews: 321, delivery: "Free delivery" },
    { title: "No link", source: "X" },
    { title: "Used jacket", source: "eBay", link: "https://ebay.com/x", second_hand_condition: "Pre-owned", extracted_price: 10 },
    { title: "Google page only", source: "Shop", product_link: "https://www.google.com/shopping/product/1", price: "$20.00", extracted_price: 20 },
  ], "₹");
  assert.equal(out.length, 2);
  assert.equal(out[0].currency, "₹");
  assert.equal(out[0].oldPrice, 2999);
  assert.equal(out[0].rating, 4.4);
  assert.equal(out[1].currency, "$");
  assert.equal(out[1].url, "https://www.google.com/shopping/product/1");
  assert.deepEqual(normalise(undefined, "$"), []);
});

test("page parsing: JSON-LD product, graph, Open Graph fallback, nothing", () => {
  const ld = `<html><head><meta property="og:site_name" content="Demo Store"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Linen &amp; Cotton Shirt","image":["/img/a.jpg"],"offers":{"@type":"Offer","price":"1,499.00","priceCurrency":"INR"},"aggregateRating":{"ratingValue":"4.5","reviewCount":"210"}}</script></head></html>`;
  const a = parseProductHtml(ld, "https://shop.example/p/1")!;
  assert.equal(a.title, "Linen & Cotton Shirt");
  assert.equal(a.price, 1499);
  assert.equal(a.currency, "₹");
  assert.equal(a.rating, 4.5);
  assert.equal(a.reviews, 210);
  assert.equal(a.imageUrl, "https://shop.example/img/a.jpg");
  assert.equal(a.merchant, "Demo Store");
  const graph = `<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":["Product","Thing"],"name":"Boot","offers":[{"price":99.5,"priceCurrency":"USD"}]}]}</script>`;
  const b = parseProductHtml(graph, "https://www.boots.example/x")!;
  assert.equal(b.title, "Boot"); assert.equal(b.price, 99.5); assert.equal(b.currency, "$"); assert.equal(b.merchant, "boots.example");
  const og = `<meta property="og:title" content="Wool Coat"><meta property="og:image" content="https://i/c.jpg"><meta property="product:price:amount" content="249"><meta property="product:price:currency" content="GBP">`;
  const c = parseProductHtml(og, "https://x.example/c")!;
  assert.equal(c.title, "Wool Coat"); assert.equal(c.price, 249); assert.equal(c.currency, "£");
  assert.equal(parseProductHtml("<html><body>hello</body></html>", "https://x.example"), null);
  assert.equal(parseProductHtml("<script type=\"application/ld+json\">{broken</script><title>x</title>", "https://x.example"), null);
});

test("URL safety: private and non-web addresses are refused", async () => {
  for (const bad of ["http://localhost:3000/x", "http://127.0.0.1/x", "http://10.0.0.5/x", "http://192.168.1.1/", "http://169.254.169.254/latest", "http://[::1]/", "ftp://example.com/x", "javascript:alert(1)", "not a url"])
    await assert.rejects(() => assertPublicUrl(bad), Error, bad);
});

test("store links per country", () => {
  assert.equal(COUNTRIES.length, 8);
  assert.equal(country("zz").code, "IN");
  const inLinks = searchLinks("olive overshirt men", "IN");
  assert.ok(inLinks.some((l) => l.name === "Myntra" && l.url === "https://www.myntra.com/olive-overshirt-men"));
  assert.ok(inLinks.some((l) => l.url.includes("amazon.in/s?k=olive%20overshirt%20men")));
  assert.ok(searchLinks("x", "GB").some((l) => l.url.includes("amazon.co.uk")));
  assert.ok(searchLinks("x", "US").every((l) => l.url.startsWith("https://")));
});
